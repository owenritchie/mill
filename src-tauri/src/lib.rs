use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::webview::PageLoadEvent;
use tauri::{Manager, RunEvent, WebviewWindow};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct Server(Mutex<Option<CommandChild>>);

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

const TITLEBAR_JS: &str = r#"
(function () {
  if (document.getElementById('mill-titlebar')) return;
  var style = document.createElement('style');
  style.textContent =
    'html,body{box-sizing:border-box}' +
    'body{padding-top:28px!important}' +
    '#mill-titlebar{position:fixed;top:0;left:0;right:0;height:28px;' +
    'background:#1A471C;color:#fff;display:flex;align-items:center;' +
    'justify-content:center;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;' +
    'font-size:13px;font-weight:600;z-index:2147483647;' +
    '-webkit-user-select:none;user-select:none;cursor:default}';
  document.head.appendChild(style);
  var bar = document.createElement('div');
  bar.id = 'mill-titlebar';
  bar.setAttribute('data-tauri-drag-region', '');
  bar.textContent = 'Mill';
  document.body.appendChild(bar);
})();
"#;

fn login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let output = std::process::Command::new(&shell)
        .args(["-ilc", "printf '__MILL_PATH__%s' \"$PATH\""])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let path = stdout.rsplit("__MILL_PATH__").next()?.trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

fn show_error(window: &WebviewWindow, message: &str) {
    let escaped = message.replace('\\', "\\\\").replace('`', "\\`");
    let _ = window.eval(&format!(
        "document.querySelector('main').innerHTML = \
         `<h1>Mill</h1><p style=\"max-width:34ch;text-align:center;line-height:1.5\">{escaped}</p>`"
    ));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Server(Mutex::new(None)))
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = webview.eval(TITLEBAR_JS);
            }
        })
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stderr),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: Some("mill".into()),
                        }),
                    ])
                    .build(),
            )?;

            let port = portpicker::pick_unused_port().ok_or("no free port available")?;
            let server_dir = app.path().resource_dir()?.join("standalone");
            let server_js = server_dir.join("mill-server.mjs");

            log::info!("starting server: {} on port {}", server_js.display(), port);

            let resolved_path = login_shell_path();
            match &resolved_path {
                Some(p) => log::info!("resolved login shell PATH: {p}"),
                None => log::warn!("could not resolve login shell PATH; CLI tools may not be found"),
            }

            let mut command = app
                .shell()
                .sidecar("node")
                .map_err(|e| {
                    log::error!("could not resolve node sidecar: {e}");
                    e
                })?
                .args([server_js.to_string_lossy().to_string()])
                .current_dir(server_dir)
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .env("NODE_ENV", "production");

            if let Some(path) = resolved_path {
                command = command.env("PATH", path);
            }

            let (mut rx, child) = command.spawn()?;

            app.state::<Server>().0.lock().unwrap().replace(child);

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            log::info!("[next] {}", String::from_utf8_lossy(&line).trim_end());
                        }
                        CommandEvent::Terminated(payload) => {
                            log::error!("[next] exited: {:?}", payload.code);
                        }
                        _ => {}
                    }
                }
            });

            let window = app.get_webview_window("main").ok_or("no main window")?;
            std::thread::spawn(move || {
                if wait_for_server(port, Duration::from_secs(30)) {
                    let url = format!("http://127.0.0.1:{port}");
                    if let Ok(parsed) = url.parse() {
                        let _ = window.navigate(parsed);
                    }
                } else {
                    show_error(
                        &window,
                        "The Mill server did not start. Reinstalling the app usually fixes this.",
                    );
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app.state::<Server>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
