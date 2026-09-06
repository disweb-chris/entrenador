import { useEffect, useRef } from "react";
import { DAYS, Z } from "../lib/constants";

function summarize(session) {
  let done = 0, vol = 0;
  for (const ex of Object.values(session.exercises || {})) {
    for (const s of ex.sets || []) {
      if (!s.done) continue;
      done++;
      vol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
    }
  }
  return { done, vol };
}

/**
 * Sesiones anteriores, para revisarlas o corregirlas. Se abre desde la fecha del
 * encabezado: es una navegación entre sesiones, no otra vista de la sesión
 * actual, así que no le corresponde estar entre HOY / INFORME / OBJETIVOS.
 */
export default function SessionPicker({ sessions, activeDateKey, todayDateKey, onPick, onClose, loading, error }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const withWork = (sessions || []).filter(s => summarize(s).done > 0);

  return (
    <div
      onClick={e => { if (!panelRef.current?.contains(e.target)) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: Z.picker,
        background: "rgba(10,10,10,0.82)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "64px 14px 14px",
      }}
      role="dialog" aria-modal="true" aria-label="Sesiones anteriores">
      <div ref={panelRef} style={{
        background: "#111", border: "1px solid #1e1e1e", borderRadius: "12px",
        width: "100%", maxWidth: "460px", maxHeight: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 8px 0 16px", borderBottom: "1px solid #1a1a1a", flexShrink: 0,
        }}>
          <span style={{ fontSize: "12px", color: "#888", letterSpacing: "2px" }}>SESIONES ANTERIORES</span>
          <button onClick={onClose} aria-label="Cerrar"
            style={{
              background: "transparent", border: "none", color: "#888", fontSize: "20px",
              cursor: "pointer", minWidth: "44px", minHeight: "44px",
            }}>
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 0" }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "#888", fontSize: "12px", letterSpacing: "1px" }}>
              CARGANDO…
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: "28px 20px", textAlign: "center", fontSize: "12px", letterSpacing: "1px", lineHeight: 1.8 }}>
              <div style={{ color: "#fca5a5" }}>NO SE PUDO LEER EL HISTORIAL</div>
              {error.indexUrl && (
                <a href={error.indexUrl} target="_blank" rel="noreferrer"
                  style={{ color: "#3b82f6", textDecoration: "underline", display: "inline-block", padding: "10px 0" }}>
                  CREAR EL ÍNDICE EN FIREBASE →
                </a>
              )}
            </div>
          )}

          {!loading && !error && withWork.length === 0 && (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#888", fontSize: "13px", lineHeight: 1.7 }}>
              Todavía no hay sesiones registradas.<br />
              Cuando completes series van a aparecer acá.
            </div>
          )}

          {!loading && !error && withWork.map(s => {
            const { done, vol } = summarize(s);
            const day = DAYS.find(d => d.key === s.dayKey);
            const isActive = s.dateKey === activeDateKey && s.dayKey;
            return (
              <button key={`${s.dateKey}_${s.dayKey}`}
                onClick={() => onPick(s)}
                aria-current={isActive ? "true" : undefined}
                style={{
                  display: "flex", width: "100%", alignItems: "center", gap: "12px",
                  minHeight: "56px", padding: "8px 16px", textAlign: "left",
                  background: isActive ? "#181818" : "transparent",
                  border: "none", borderLeft: "none", cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                }}>
                <span style={{ color: "#f0f0f0", fontSize: "13px", flexShrink: 0, width: "84px" }}>
                  {s.dateKey}
                </span>
                <span style={{ color: "#888", fontSize: "12px", letterSpacing: "1px", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(day?.focus || s.dayKey || "").toUpperCase()}
                </span>
                <span style={{ color: "#888", fontSize: "12px", flexShrink: 0, textAlign: "right" }}>
                  {done} · {vol.toLocaleString()}kg
                </span>
                {s.dateKey === todayDateKey && (
                  <span style={{ color: "#22c55e", fontSize: "11px", letterSpacing: "1px", flexShrink: 0 }}>HOY</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
