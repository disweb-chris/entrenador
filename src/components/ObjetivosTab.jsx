import { useState, useMemo, useRef, useEffect } from "react";
import TargetRow from "./TargetRow";
import { sortedExercises, DAYS } from "../lib/constants";
import { parseRoutineText } from "../lib/routineParser";
import { diffRoutineDay } from "../lib/routine";

function targetLabel(t) {
  if (!t) return "—";
  const parts = [];
  if (t.series != null) parts.push(t.series);
  const reps = Array.isArray(t.reps_por_serie) ? t.reps_por_serie[0] : t.reps;
  if (reps != null) parts.push(`×${reps}`);
  if (t.peso != null) parts.push(`@${t.peso}kg`);
  return parts.join("") || "—";
}

const previewRow = { display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "4px", lineHeight: 1.4 };
const previewName = { fontSize: "13px", fontFamily: "'DM Mono', monospace", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ObjetivosTab({
  session,
  targets,
  activeDay,
  weekKey,
  routine,
  onTargetChange,
  onTargetRemove,
  onTargetsMerge,
  onRoutineChange,
}) {
  const [mode, setMode] = useState("edit");
  const [pasteText, setPasteText] = useState("");
  const [applyStatus, setApplyStatus] = useState(null); // null | "ok" | "partial" | "error"
  const [applyMsg, setApplyMsg] = useState("");
  const applyTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const parsed = useMemo(() => parseRoutineText(pasteText), [pasteText]);
  const targetEntries = useMemo(() => Object.entries(parsed.targets), [parsed]);

  // Qué cambia en la rutina de cada día que venga en el texto pegado.
  const routineDiffs = useMemo(() => {
    if (!parsed.routine) return [];
    return Object.entries(parsed.routine).map(([dayKey, next]) => ({
      dayKey,
      label: DAYS.find(d => d.key === dayKey)?.full || dayKey,
      count: next.ejercicios.length,
      diff: diffRoutineDay(routine?.[dayKey], next),
    }));
  }, [parsed, routine]);

  const hasItems = targetEntries.length > 0 || routineDiffs.length > 0;

  // Focus textarea when switching to paste mode
  useEffect(() => {
    if (mode === "paste") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [mode]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(applyTimerRef.current), []);

  function switchMode(next) {
    setMode(next);
    if (next === "edit") {
      setPasteText("");
      setApplyStatus(null);
    }
  }

  function handleApply() {
    if (!hasItems) return;

    // La rutina reemplaza el día completo; los objetivos se fusionan, porque
    // pueden venir de un pegado parcial.
    if (parsed.routine) onRoutineChange(parsed.routine);
    if (targetEntries.length) onTargetsMerge(parsed.targets);

    const partes = [];
    if (routineDiffs.length) {
      partes.push(`${routineDiffs.length} ${routineDiffs.length === 1 ? "día" : "días"} de rutina`);
    }
    if (targetEntries.length) {
      partes.push(`${targetEntries.length} ${targetEntries.length === 1 ? "objetivo" : "objetivos"}`);
    }
    const e = parsed.errors.length;

    if (e === 0) {
      setApplyStatus("ok");
      setApplyMsg(`✓ ${partes.join(" · ")}`);
      applyTimerRef.current = setTimeout(() => switchMode("edit"), 1600);
    } else {
      setApplyStatus("partial");
      setApplyMsg(`${partes.join(" · ")} · ${e} con error`);
    }
  }

  // ── Empty states ─────────────────────────────────────────────────────────────

  if (!activeDay) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div className="day-nudge" style={{ color: "#444", fontSize: "16px", marginBottom: "8px" }}>↑</div>
        <div style={{ color: "#555", fontSize: "13px", letterSpacing: "1px" }}>SELECCIONÁ UN DÍA</div>
      </div>
    );
  }

  if (Object.keys(session?.exercises || {}).length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#555", fontSize: "13px", letterSpacing: "1px" }}>
        AGREGÁ EJERCICIOS PRIMERO
      </div>
    );
  }

  // Mismo orden que la pantalla de sesión: Firestore devolvería las claves
  // del map alfabetizadas y los objetivos quedarían desalineados con la rutina.
  const exerciseNames = sortedExercises(session.exercises, activeDay).map(([name]) => name);

  // ── Segmented control ─────────────────────────────────────────────────────────

  const segBtn = (id) => ({
    padding: "0 14px",
    height: "44px",
    fontSize: "12px",
    letterSpacing: "1px",
    fontFamily: "'DM Mono', monospace",
    background: mode === id ? "#f0f0f0" : "transparent",
    color: mode === id ? "#0a0a0a" : "#555",
    border: "none",
    borderRight: id === "edit" ? "1px solid #1e1e1e" : "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{
          display: "inline-flex",
          border: "1px solid #1e1e1e",
          borderRadius: "8px",
          overflow: "hidden",
        }}>
          <button onClick={() => switchMode("edit")} style={segBtn("edit")}>
            EDICIÓN
          </button>
          <button onClick={() => switchMode("paste")} style={segBtn("paste")}>
            PEGAR
          </button>
        </div>
        <span style={{ fontSize: "12px", color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.5px" }}>
          {weekKey}
        </span>
      </div>

      {/* Edit mode */}
      {mode === "edit" && (
        <div>
          {exerciseNames.map(exName => (
            <TargetRow
              key={exName}
              name={exName}
              target={targets?.[exName] ?? null}
              onChange={(updated) => onTargetChange(exName, updated)}
              onRemove={() => onTargetRemove(exName)}
            />
          ))}
        </div>
      )}

      {/* Paste mode */}
      {mode === "paste" && (
        <div>
          <textarea
            ref={textareaRef}
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setApplyStatus(null); }}
            placeholder={"Pegá lo que te pasa Claude.\n\nRutina completa (orden, tipo, descanso y objetivo):\n{\"rutina\": {\"lunes\": {\"ejercicios\": [...]}}}\n\nO sólo objetivos, una línea por ejercicio:\nPress Plano: 3x8@80kg\nSentadilla: 4x5@100kg"}
            style={{
              width: "100%",
              minHeight: "160px",
              background: "#0f0f0f",
              border: "1px solid #1e1e1e",
              borderRadius: "8px",
              color: "#f0f0f0",
              fontFamily: "'DM Mono', monospace",
              fontSize: "14px",
              lineHeight: 1.6,
              padding: "12px",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              display: "block",
            }}
            onFocus={e => { e.target.style.borderColor = "#333"; }}
            onBlur={e => { e.target.style.borderColor = "#1e1e1e"; }}
          />

          {/* Live parse preview */}
          {pasteText.trim() && (
            <div style={{
              marginTop: "8px",
              padding: "10px 12px",
              background: "#0d0d0d",
              borderRadius: "6px",
              border: "1px solid #1a1a1a",
            }}>
              {/* Reemplazar un día entero sin ver qué se da de baja sería
                  demasiado filoso: el preview lo dice antes de aplicar. */}
              {routineDiffs.map(({ dayKey, label, count, diff }) => (
                <div key={dayKey} style={{ marginBottom: "10px" }}>
                  <div style={{ ...previewRow, color: "#f0f0f0" }}>
                    <span style={{ color: "#22c55e", fontSize: "11px", flexShrink: 0 }}>✓</span>
                    <span style={{ ...previewName, color: "#f0f0f0", letterSpacing: "1px" }}>
                      {label.toUpperCase()}
                    </span>
                    <span style={{ color: "#888", fontSize: "12px", flexShrink: 0 }}>
                      {count} {count === 1 ? "ejercicio" : "ejercicios"}
                    </span>
                  </div>
                  {diff.added.length > 0 && (
                    <div style={{ ...previewRow, paddingLeft: "19px", color: "#22c55e", fontSize: "12px" }}>
                      + {diff.added.join(", ")}
                    </div>
                  )}
                  {diff.removed.length > 0 && (
                    <div style={{ ...previewRow, paddingLeft: "19px", color: "#eab308", fontSize: "12px" }}>
                      − se quitan: {diff.removed.join(", ")}
                    </div>
                  )}
                  {diff.reordered && (
                    <div style={{ ...previewRow, paddingLeft: "19px", color: "#888", fontSize: "12px" }}>
                      · cambia el orden
                    </div>
                  )}
                  {diff.restChanged.length > 0 && (
                    <div style={{ ...previewRow, paddingLeft: "19px", color: "#888", fontSize: "12px" }}>
                      · descanso: {diff.restChanged.map(r => `${r.nombre} ${r.de}→${r.a}s`).join(", ")}
                    </div>
                  )}
                </div>
              ))}

              {targetEntries.map(([name, target]) => (
                <div key={name} style={previewRow}>
                  <span style={{ color: "#3b82f6", fontSize: "11px", flexShrink: 0 }}>◆</span>
                  <span style={{ ...previewName, color: "#cccccc" }}>{name}</span>
                  <span style={{ color: "#3b82f6", fontSize: "13px", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {targetLabel(target)}
                  </span>
                </div>
              ))}

              {parsed.errors.map((err, i) => (
                <div key={i} style={previewRow}>
                  <span style={{ color: "#ef4444", fontSize: "11px", flexShrink: 0 }}>✗</span>
                  <span style={{ color: "#888", fontSize: "12px", fontFamily: "'DM Mono', monospace" }}>
                    {err}
                  </span>
                </div>
              ))}

              {routineDiffs.length > 0 && (
                <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.5px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #1a1a1a", lineHeight: 1.6 }}>
                  La rutina se aplica desde la próxima sesión de cada día. Las
                  series ya registradas no se tocan.
                </div>
              )}
            </div>
          )}

          {/* Footer: status + apply button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", gap: "12px" }}>
            <span style={{
              fontSize: "12px",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.3px",
              color: applyStatus === "ok" ? "#22c55e" : applyStatus === "partial" ? "#f97316" : "#555",
              flex: 1,
              minHeight: "20px",
            }}>
              {applyMsg}
            </span>
            <button
              onClick={handleApply}
              disabled={!hasItems || applyStatus === "ok"}
              style={{
                background: hasItems && applyStatus !== "ok" ? "#f0f0f0" : "#1a1a1a",
                color: hasItems && applyStatus !== "ok" ? "#0a0a0a" : "#444",
                border: "none",
                borderRadius: "8px",
                padding: "12px 18px",
                fontFamily: "'DM Mono', monospace",
                fontSize: "13px",
                letterSpacing: "1px",
                cursor: hasItems && applyStatus !== "ok" ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background 150ms ease-out, color 150ms ease-out",
              }}
            >
              {hasItems ? `APLICAR (${routineDiffs.length + targetEntries.length})` : "APLICAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
