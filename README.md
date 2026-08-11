# Mill

A hierarchy-based thinking tool to help you breeze through decisions.

Everything lives locally, and can be modified via a node-based canvas editor, a table, or a text editor. Export to common formats (JSON, Markdown, CSV) or via customizable hooks that interface with additional resources such as MCP servers or databases.

Use AI models to help speed up tedious task planning or enhance existing ideas. Full support for Ollama models through an endpoint, and Claude models through the CLI (using a user's subscription).

---

## Install

Grab the latest `.dmg` from [Releases](../../releases) and drag Mill to Applications.

Mill is not code-signed, so macOS will block it on first open. To get past that:

```bash
xattr -cr /Applications/Mill.app
```

Apple Silicon only for now.

## Requirements

- **macOS** on Apple Silicon (for the packaged app)
- **[Ollama](https://ollama.com)** and/or the **Claude CLI** (only if you want AI features)

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On first run Mill creates its database at `~/.mill/mill.db`.

Point somewhere else with a `DATABASE_URL` in `.env` (any libSQL URL, e.g. `file:./dev.db`), or use
**Settings → Reset environment** to start over. Hoping to improve switching capability in the future to support cloud sync.

### Building the desktop app

```bash
npm run desktop:build      # .app + .dmg in src-tauri/target/release/bundle/
npm run desktop:install    # build, then install to /Applications
```

Needs the [Rust toolchain](https://rustup.rs) and Xcode Command Line Tools. The first build compiles
Tauri from scratch and takes a few minutes; later ones are quick. A pinned Node runtime is
downloaded automatically and bundled into the app, so users don't need anything installed.

Runtime logs, including the bundled server's output, go to
`~/Library/Logs/com.owenritchie.mill/mill.log`.

### Releasing

Bump the version in `package.json` **and** `src-tauri/tauri.conf.json`, then:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

GitHub Actions builds the app and publishes a release with the `.dmg` attached.

## How it works

The UI is a Next.js app. In the browser that's all there is. In the desktop build, a small Rust
shell (Tauri) starts the Next production server as a bundled sidecar on a random local port, then
points a native window at it — so the same code runs in both places.

```
Tauri window (WKWebView) ──► http://127.0.0.1:<port>
                                     ▲
                      Rust spawns ───┘
                      bundled node + Next standalone server
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM · libSQL (SQLite) · Tauri 2

## Layout

```
app/           Routes and Server Actions
components/    UI: canvas, cards, chat, doc, layout, settings
lib/db/        Drizzle schema, libSQL client, migrations
lib/ai/        Provider transport (Ollama + Claude CLI)
drizzle/       Generated SQL migrations
src-tauri/     Desktop shell (Rust)
scripts/       Seed data and desktop build tooling
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Seed sample data |
| `npm run desktop:build` | Build `.app` + `.dmg` |
| `npm run desktop:install` | Build and install to `/Applications` |
