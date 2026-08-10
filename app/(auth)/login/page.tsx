export default function LoginPage() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: 36,
            color: "var(--ink)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Mill
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>Auth coming soon.</p>
      </div>
    </div>
  );
}
