import { useState, useEffect, useRef } from "react";
import { RIR_CONFIG, FATIGUE_CONFIG, REST_DEFAULTS, makeEmptySet } from "../lib/constants";

export default function ExerciseCard({ name, type, data, lastData, target, onUpdate, onDelete, onStartRest }) {
  const [showNotes, setShowNotes] = useState(false);
  const didAutoFill = useRef(false);

  const sets = data.sets || [];
  const lastSets = (lastData?.sets || []).filter(s => s.done);

  useEffect(() => {
    if (didAutoFill.current) return;
    if (!lastSets.length) return;
    const needsFill = sets.some(s => s.weight === "" && s.reps === "");
    if (!needsFill) return;
    didAutoFill.current = true;
    const filled = sets.map((s, i) => {
      if (s.weight !== "" || s.reps !== "") return s;
      const src = lastSets[i] ?? lastSets[lastSets.length - 1];
      return { ...s, weight: src.weight || "", reps: src.reps || "" };
    });
    onUpdate({ ...data, sets: filled });
  }, [lastData]); // eslint-disable-line react-hooks/exhaustive-deps

  const rirAvg = (() => {
    const done = sets.filter(s => s.done && s.rir !== null);
    if (!done.length) return null;
    return (done.reduce((a, b) => a + b.rir, 0) / done.length).toFixed(1);
  })();

  const hasRir0 = sets.filter(s => s.done && s.rir === 0).length > 1;

  function updateSet(i, field, val) {
    const updated = sets.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    onUpdate({ ...data, sets: updated });
  }

  function addSet() {
    const nextIdx = sets.length;
    const fromLast = lastSets[nextIdx] ?? lastSets[lastSets.length - 1];
    const fromPrev = sets[sets.length - 1] || {};
    const src = fromLast || fromPrev;
    onUpdate({ ...data, sets: [...sets, { ...makeEmptySet(), weight: src.weight || "", reps: src.reps || "" }] });
  }

  function removeSet(i) {
    if (sets.length <= 1) return;
    onUpdate({ ...data, sets: sets.filter((_, idx) => idx !== i) });
  }

  function markDone(i) {
    const s = sets[i];
    const newDone = !s.done;
    updateSet(i, "done", newDone);
    if (newDone) {
      const restSecs = data.restTime ?? REST_DEFAULTS[type] ?? 60;
      onStartRest(restSecs, name, type);
    }
  }

  const totalVol = sets
    .filter(s => s.done)
    .reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);

  return (
    <div style={{
      background: "#111", border: `1px solid ${hasRir0 ? "#7f1d1d" : "#1e1e1e"}`,
      borderRadius: "12px", padding: "16px", marginBottom: "10px",
      fontFamily: "'DM Mono', monospace",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: "500", letterSpacing: "0.5px", marginBottom: "4px" }}>{name}</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#888", letterSpacing: "1px", textTransform: "uppercase" }}>{type}</span>
            {totalVol > 0 && <span style={{ fontSize: "12px", color: "#888" }}>· {totalVol}kg vol</span>}
            {target && (
              <span style={{ fontSize: "12px", color: "#3b82f6", letterSpacing: "0.5px" }}>
                · Obj: {target.series}×
                {target.reps_por_serie ? target.reps_por_serie.join("/") : target.reps}
                {target.peso != null ? `@${target.peso}kg` : ""}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {hasRir0 && (
            <div style={{ fontSize: "12px", background: "#7f1d1d", color: "#fca5a5", padding: "4px 8px", borderRadius: "4px" }}>
              ⚠ RIR 0
            </div>
          )}
          {rirAvg !== null && (
            <div style={{
              fontSize: "13px", padding: "4px 10px", borderRadius: "6px",
              background: RIR_CONFIG[Math.min(4, Math.round(rirAvg))]?.bg,
              color: RIR_CONFIG[Math.min(4, Math.round(rirAvg))]?.text,
            }}>
              RIR {rirAvg}
            </div>
          )}
          {onDelete && (
            <button onClick={onDelete}
              style={{
                background: "transparent", border: "none", color: "#444",
                fontSize: "18px", cursor: "pointer", padding: "4px 6px",
                minWidth: "44px", minHeight: "44px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono'",
              }}
              aria-label={`Eliminar ${name}`}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Last session comparison */}
      {lastSets.length > 0 && (
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px", padding: "8px 10px", background: "#0d0d0d", borderRadius: "6px", letterSpacing: "0.5px" }}>
          Anterior: {lastSets.length}×{lastSets[0]?.reps}@{lastSets[0]?.weight}kg
          {lastSets[0]?.rir !== null && ` · RIR ${lastSets[0]?.rir}`}
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 36px", gap: "6px", paddingBottom: "6px", color: "#555", fontSize: "11px", letterSpacing: "1.5px" }}>
        <div />
        <div style={{ textAlign: "center" }}>PESO</div>
        <div style={{ textAlign: "center" }}>REPS</div>
        <div />
      </div>

      {/* Sets */}
      {sets.map((s, i) => (
        <div key={i} style={{ marginBottom: "12px", opacity: s.done ? 0.55 : 1, transition: "opacity 0.2s ease-out" }}>
          {/* Row 1: done + inputs + delete */}
          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 36px", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
            <button onClick={() => markDone(i)}
              style={{
                width: "44px", height: "44px", borderRadius: "50%",
                border: `2px solid ${s.done ? "#22c55e" : "#444"}`,
                background: s.done ? "#22c55e" : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, padding: 0,
                transition: "background 0.2s ease-out, border-color 0.2s ease-out, transform 120ms ease-out",
              }}>
              {s.done && <span style={{ fontSize: "18px", color: "#f0f0f0", lineHeight: 1 }}>✓</span>}
            </button>

            <input type="number" placeholder="kg" value={s.weight}
              onChange={e => updateSet(i, "weight", e.target.value)}
              style={inputSt} />

            <input type="number" placeholder="reps" value={s.reps}
              onChange={e => updateSet(i, "reps", e.target.value)}
              style={inputSt} />

            <button onClick={() => removeSet(i)}
              style={{ background: "transparent", border: "none", color: "#555", fontSize: "22px", cursor: "pointer", padding: 0, width: "36px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ×
            </button>
          </div>

          {/* Row 2: RIR + Fatigue */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "3px" }}>
                {[0, 1, 2, 3, 4].map(r => (
                  <button key={r}
                    onClick={() => updateSet(i, "rir", s.rir === r ? null : r)}
                    style={{
                      ...btnSt,
                      background: s.rir === r ? RIR_CONFIG[r].bg : "transparent",
                      color: s.rir === r ? RIR_CONFIG[r].text : "#555",
                      borderColor: s.rir === r ? RIR_CONFIG[r].bg : "#333",
                    }}>
                    {r === 4 ? "4+" : r}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1.5px", textAlign: "center" }}>RIR</div>
            </div>

            <div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "3px" }}>
                {[1, 2, 3, 4, 5].map(f => (
                  <button key={f}
                    onClick={() => updateSet(i, "fatigue", s.fatigue === f ? null : f)}
                    style={{
                      ...btnSt,
                      background: s.fatigue === f ? FATIGUE_CONFIG[f].bg : "transparent",
                      color: s.fatigue === f ? FATIGUE_CONFIG[f].text : "#555",
                      borderColor: s.fatigue === f ? FATIGUE_CONFIG[f].bg : "#333",
                    }}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1.5px", textAlign: "center" }}>FATIGA</div>
            </div>
          </div>
        </div>
      ))}

      {/* Add set */}
      <button onClick={() => addSet()}
        style={{
          background: "transparent", border: "1px dashed #333", color: "#555",
          borderRadius: "6px", padding: "12px", width: "100%",
          fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px", cursor: "pointer",
          marginBottom: "12px",
        }}>
        + SERIE
      </button>

      {/* Rest time */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", color: "#555", letterSpacing: "1px" }}>DESCANSO</span>
        <input
          type="number"
          value={data.restTime ?? REST_DEFAULTS[type] ?? 60}
          onChange={e => onUpdate({ ...data, restTime: parseInt(e.target.value) || 60 })}
          style={{ ...inputSt, width: "68px" }}
        />
        <span style={{ fontSize: "12px", color: "#555" }}>seg</span>
      </div>

      {/* Exercise notes */}
      <button onClick={() => setShowNotes(!showNotes)}
        style={{ background: "transparent", border: "none", color: data.notes ? "#888" : "#444", fontSize: "13px", fontFamily: "'DM Mono'", cursor: "pointer", letterSpacing: "0.5px", padding: "4px 0" }}>
        {data.notes ? `📝 ${data.notes.slice(0, 40)}${data.notes.length > 40 ? "…" : ""}` : "+ nota del ejercicio"}
      </button>
      {showNotes && (
        <textarea
          value={data.notes || ""}
          onChange={e => onUpdate({ ...data, notes: e.target.value })}
          placeholder="Ej: usé máquina libre, bajé peso por fatiga..."
          rows={2}
          style={{
            width: "100%", marginTop: "8px", background: "#0f0f0f",
            border: "1px solid #1e1e1e", color: "#ccc", padding: "10px 12px",
            borderRadius: "6px", fontFamily: "'DM Mono'", fontSize: "14px",
            resize: "none", outline: "none",
          }}
        />
      )}
    </div>
  );
}

const inputSt = {
  background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#f0f0f0",
  padding: "10px 8px", borderRadius: "6px", fontFamily: "'DM Mono'",
  fontSize: "16px", outline: "none", width: "100%", textAlign: "center",
};

const btnSt = {
  border: "1px solid", borderRadius: "5px", padding: "8px 2px",
  fontSize: "13px", cursor: "pointer", fontFamily: "'DM Mono'",
  transition: "transform 120ms ease-out", flex: 1, textAlign: "center",
};
