export default function RestTimer({ timer, onSkip, onAdjust }) {
  if (!timer.active && timer.remaining === 0 && timer.total === 0) return null;

  const { remaining, total, pct, active } = timer;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins > 0 ? `${mins}:` : ""}${String(secs).padStart(2, "0")}`;
  const isWarning = remaining <= 5 && active;
  const isDone = !active && total > 0;

  const color = isDone ? "#22c55e" : isWarning ? "#ef4444" : "#f0f0f0";

  // Arc for circular progress
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * pct) / 100;

  return (
    <div style={{
      position: "fixed", top: "16px", right: "16px", zIndex: 999,
      background: "#111", border: `1px solid ${isWarning ? "#ef4444" : isDone ? "#22c55e" : "#555"}`,
      borderRadius: "12px", padding: "12px 16px", minWidth: "140px",
      boxShadow: `0 0 20px ${isWarning ? "rgba(239,68,68,0.2)" : "rgba(0,0,0,0.5)"}`,
      fontFamily: "'DM Mono', monospace",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Circular arc */}
        <svg width="56" height="56" style={{ flexShrink: 0 }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke="#1e1e1e" strokeWidth="4" />
          <circle
            cx="28" cy="28" r={r} fill="none"
            stroke={color} strokeWidth="4"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
          <text x="28" y="33" textAnchor="middle"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "16px", fill: color, letterSpacing: "1px" }}>
            {isDone ? "GO" : timeStr}
          </text>
        </svg>

        <div>
          <div style={{ fontSize: "10px", color: "#ccc", letterSpacing: "1px", marginBottom: "4px" }}>
            {isDone ? "¡LISTO!" : isWarning ? "PREPARATE" : "DESCANSO"}
          </div>

          {/* Adjust buttons */}
          {active && (
            <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
              {[-15, +15].map(delta => (
                <button key={delta}
                  onClick={() => onAdjust(delta)}
                  style={{
                    background: "#1a1a1a", border: "1px solid #333", color: "#bbb",
                    borderRadius: "3px", padding: "2px 6px", fontSize: "10px",
                    fontFamily: "'DM Mono'", cursor: "pointer",
                  }}>
                  {delta > 0 ? `+${delta}s` : `${delta}s`}
                </button>
              ))}
            </div>
          )}

          <button onClick={onSkip}
            style={{
              background: "transparent", border: "1px solid #333", color: "#ccc",
              borderRadius: "4px", padding: "3px 8px", fontSize: "10px",
              fontFamily: "'DM Mono'", cursor: "pointer", letterSpacing: "1px",
              width: "100%",
            }}>
            {isDone ? "CERRAR" : "SALTEAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
