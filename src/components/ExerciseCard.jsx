import { useState } from "react";
import { RIR_CONFIG, FATIGUE_CONFIG, REST_DEFAULTS, makeEmptySet } from "../lib/constants";

export default function ExerciseCard({ name, type, data, lastData, target, onUpdate, onStartRest }) {
  const [showNotes, setShowNotes] = useState(false);
  const [restInput, setRestInput] = useState(null); // null = use saved

  const sets = data.sets || [];
  const lastSets = (lastData?.sets || []).filter(s => s.done);

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
    const prev = sets[sets.length - 1] || {};
    onUpdate({ ...data, sets: [...sets, { ...makeEmptySet(), weight: prev.weight || "", reps: prev.reps || "" }] });
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
      borderRadius: "10px", padding: "12px", marginBottom: "8px",
      fontFamily: "'DM Mono', monospace",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", fontWeight: "500", letterSpacing: "0.5px", marginBottom: "2px" }}>{name}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "9px", color: "#bbb", letterSpacing: "1px", textTransform: "uppercase" }}>{type}</span>
            {totalVol > 0 && <span style={{ fontSize: "9px", color: "#bbb" }}>· {totalVol}kg vol</span>}
            {target && (
              <span style={{ fontSize: "9px", color: "#3b82f6", letterSpacing: "0.5px" }}>
                · Obj: {target.series}×
                {target.reps_por_serie
                  ? target.reps_por_serie.join("/")
                  : target.reps}
                {target.peso != null ? `@${target.peso}kg` : ""}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {hasRir0 && (
            <div style={{ fontSize: "9px", background: "#7f1d1d", color: "#fca5a5", padding: "2px 6px", borderRadius: "4px" }}>
              ⚠ RIR 0
            </div>
          )}
          {rirAvg !== null && (
            <div style={{
              fontSize: "10px", padding: "2px 7px", borderRadius: "10px",
              background: RIR_CONFIG[Math.min(4, Math.round(rirAvg))]?.bg,
              color: RIR_CONFIG[Math.min(4, Math.round(rirAvg))]?.text,
            }}>
              RIR {rirAvg}
            </div>
          )}
        </div>
      </div>

      {/* Last session comparison */}
      {lastSets.length > 0 && (
        <div style={{ fontSize: "10px", color: "#bbb", marginBottom: "8px", padding: "4px 8px", background: "#0d0d0d", borderRadius: "4px", letterSpacing: "0.5px" }}>
          Anterior: {lastSets.length}×{lastSets[0]?.reps}@{lastSets[0]?.weight}kg
          {lastSets[0]?.rir !== null && ` · RIR ${lastSets[0]?.rir}`}
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "20px 72px 60px 1fr 1fr 20px", gap: "4px", padding: "0 0 4px", color: "#bbb", fontSize: "9px", letterSpacing: "1px" }}>
        <div></div><div>PESO</div><div>REPS</div><div>RIR</div><div>FATIGA</div><div></div>
      </div>

      {/* Sets */}
      {sets.map((s, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "20px 72px 60px 1fr 1fr 20px",
          gap: "4px", alignItems: "center", padding: "5px 0",
          borderTop: "1px solid #171717", opacity: s.done ? 0.7 : 1,
        }}>
          {/* Done */}
          <button onClick={() => markDone(i)}
            style={{
              width: "18px", height: "18px", borderRadius: "50%",
              border: `2px solid ${s.done ? "#22c55e" : "#555"}`,
              background: s.done ? "#22c55e" : "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, padding: 0,
            }}>
            {s.done && <span style={{ fontSize: "9px", color: "#fff", lineHeight: 1 }}>✓</span>}
          </button>

          {/* Weight */}
          <input type="number" placeholder="kg" value={s.weight}
            onChange={e => updateSet(i, "weight", e.target.value)}
            style={{ ...inputSt, textAlign: "center" }} />

          {/* Reps */}
          <input type="number" placeholder="reps" value={s.reps}
            onChange={e => updateSet(i, "reps", e.target.value)}
            style={{ ...inputSt, textAlign: "center" }} />

          {/* RIR */}
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {[0, 1, 2, 3, 4].map(r => (
              <button key={r}
                onClick={() => updateSet(i, "rir", s.rir === r ? null : r)}
                style={{
                  ...btnSt,
                  background: s.rir === r ? RIR_CONFIG[r].bg : "transparent",
                  color: s.rir === r ? RIR_CONFIG[r].text : "#444",
                  borderColor: s.rir === r ? RIR_CONFIG[r].bg : "#555",
                  transform: s.rir === r ? "scale(1.1)" : "scale(1)",
                }}>
                {r === 4 ? "4+" : r}
              </button>
            ))}
          </div>

          {/* Fatigue */}
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map(f => (
              <button key={f}
                onClick={() => updateSet(i, "fatigue", s.fatigue === f ? null : f)}
                style={{
                  ...btnSt,
                  background: s.fatigue === f ? FATIGUE_CONFIG[f].bg : "transparent",
                  color: s.fatigue === f ? FATIGUE_CONFIG[f].text : "#444",
                  borderColor: s.fatigue === f ? FATIGUE_CONFIG[f].bg : "#555",
                  transform: s.fatigue === f ? "scale(1.1)" : "scale(1)",
                }}>
                {f}
              </button>
            ))}
          </div>

          {/* Remove */}
          <button onClick={() => removeSet(i)}
            style={{ background: "transparent", border: "none", color: "#ccc", fontSize: "14px", cursor: "pointer", padding: 0 }}>
            ×
          </button>
        </div>
      ))}

      {/* Set notes (per set — inline below last set) */}
      <div style={{ marginTop: "8px" }}>
        <button onClick={() => addSet()}
          style={{
            background: "transparent", border: "1px dashed #222", color: "#bbb",
            borderRadius: "4px", padding: "5px", width: "100%",
            fontFamily: "'DM Mono'", fontSize: "11px", letterSpacing: "1px", cursor: "pointer",
          }}>
          + SERIE
        </button>
      </div>

      {/* Rest time config */}
      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", color: "#bbb", letterSpacing: "1px" }}>DESCANSO</span>
        <input
          type="number"
          value={data.restTime ?? REST_DEFAULTS[type] ?? 60}
          onChange={e => onUpdate({ ...data, restTime: parseInt(e.target.value) || 60 })}
          style={{ ...inputSt, width: "52px", textAlign: "center" }}
        />
        <span style={{ fontSize: "10px", color: "#bbb" }}>seg</span>
      </div>

      {/* Exercise notes toggle */}
      <div style={{ marginTop: "8px" }}>
        <button onClick={() => setShowNotes(!showNotes)}
          style={{ background: "transparent", border: "none", color: data.notes ? "#888" : "#777", fontSize: "10px", fontFamily: "'DM Mono'", cursor: "pointer", letterSpacing: "0.5px", padding: 0 }}>
          {data.notes ? `📝 ${data.notes.slice(0, 40)}${data.notes.length > 40 ? "…" : ""}` : "+ nota del ejercicio"}
        </button>
        {showNotes && (
          <textarea
            value={data.notes || ""}
            onChange={e => onUpdate({ ...data, notes: e.target.value })}
            placeholder="Ej: usé máquina libre, bajé peso por fatiga, dolor en hombro..."
            rows={2}
            style={{
              width: "100%", marginTop: "6px", background: "#0f0f0f",
              border: "1px solid #1e1e1e", color: "#ccc", padding: "6px 8px",
              borderRadius: "4px", fontFamily: "'DM Mono'", fontSize: "11px",
              resize: "none", outline: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}

const inputSt = {
  background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#f0f0f0",
  padding: "5px 6px", borderRadius: "4px", fontFamily: "'DM Mono'",
  fontSize: "12px", outline: "none", width: "100%",
};

const btnSt = {
  border: "1px solid", borderRadius: "3px", padding: "3px 5px",
  fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono'",
  transition: "all 0.12s", minWidth: "22px",
};
