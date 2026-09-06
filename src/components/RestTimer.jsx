import { Z } from "../lib/constants";

export default function RestTimer({ timer, onSkip, onAdjust }) {
  if (!timer.active && timer.remaining === 0 && timer.total === 0) return null;

  const { remaining, total, pct, active } = timer;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins > 0 ? `${mins}:` : ""}${String(secs).padStart(2, "0")}`;
  const isWarning = remaining <= 5 && active;
  const isDone = !active && total > 0;

  const color = isDone ? "#22c55e" : isWarning ? "#ef4444" : "#f0f0f0";

  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * pct) / 100;

  return (
    <div style={{
      position: "fixed", top: "16px", right: "16px", zIndex: Z.restTimer,
      background: "#111", border: `1px solid ${isWarning ? "#ef4444" : isDone ? "#22c55e" : "#333"}`,
      // Sin box-shadow y radio 12: DESIGN.md define el sistema como plano, con
      // el borde como única señal de profundidad, y fija 12px como techo.
      // El estado de aviso ya lo lleva el color del borde.
      borderRadius: "12px", padding: "14px 18px", minWidth: "168px",
      fontFamily: "'DM Mono', monospace",
      transition: "border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Circular arc */}
        <svg width="72" height="72" style={{ flexShrink: 0 }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1e1e1e" strokeWidth="4" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="4"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
          <text x="36" y="42" textAnchor="middle"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", fill: color, letterSpacing: "1px" }}>
            {isDone ? "GO" : timeStr}
          </text>
        </svg>

        <div>
          <div style={{ fontSize: "12px", color: "#ccc", letterSpacing: "1.5px", marginBottom: "8px" }}>
            {isDone ? "¡LISTO!" : isWarning ? "PREPARATE" : "DESCANSO"}
          </div>

          {active && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              {[-15, +15].map(delta => (
                <button key={delta}
                  onClick={() => onAdjust(delta)}
                  style={{
                    background: "#1a1a1a", border: "1px solid #333", color: "#ccc",
                    borderRadius: "6px", padding: "6px 10px", fontSize: "12px",
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
              borderRadius: "6px", padding: "8px 14px", fontSize: "13px",
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
