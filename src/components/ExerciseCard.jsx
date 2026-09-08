import { useState, useEffect, useMemo, useRef } from "react";
import { RIR_CONFIG, FATIGUE_CONFIG, REST_DEFAULTS, makeEmptySet } from "../lib/constants";
import { suggestProgression, SUGGESTION_COLOR } from "../lib/progression";
import ProgressionChart from "./ProgressionChart";
import { recordStatus, formatMark, roundKg } from "../lib/records";
import { stagnationLabel } from "../lib/stagnation";

export default function ExerciseCard({ name, type, data, lastData, target, onUpdate, onDelete, onStartRest, loadHistory, best, stagnation }) {
  const [showNotes, setShowNotes] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyState, setHistoryState] = useState("idle"); // idle | loading | ready | error
  const [indexUrl, setIndexUrl] = useState(null);
  const didAutoFill = useRef(false);

  const sets = data.sets || [];
  const lastSets = (lastData?.sets || []).filter(s => s.done);

  // Qué tocaría hacer hoy según cómo se sintió la sesión anterior.
  const suggestion = useMemo(() => suggestProgression(lastData, type), [lastData, type]);

  // Récord: el 1RM estimado permite comparar 5×100 contra 8×90, que en peso
  // bruto no son comparables.
  const record = useMemo(() => recordStatus(sets, best), [sets, best]);

  useEffect(() => {
    if (didAutoFill.current) return;
    if (!lastSets.length) return;
    const needsFill = sets.some(s => s.weight === "" && s.reps === "");
    if (!needsFill) return;
    didAutoFill.current = true;
    const filled = sets.map((s, i) => {
      if (s.weight !== "" || s.reps !== "") return s;
      // Con RIR de la sesión anterior se arranca en la carga sugerida;
      // sin RIR se repite lo hecho la última vez.
      if (suggestion) {
        return { ...s, weight: String(suggestion.weight), reps: String(suggestion.reps) };
      }
      const src = lastSets[i] ?? lastSets[lastSets.length - 1];
      return { ...s, weight: src.weight || "", reps: src.reps || "" };
    });
    // Marcado como autofill: es una escritura del sistema, no del usuario. Sin
    // esto, abrir un día para mirarlo guardaba una sesión que nunca entrenaste.
    onUpdate({ ...data, sets: filled }, { autofill: true });
  }, [lastData]); // eslint-disable-line react-hooks/exhaustive-deps

  const rirAvg = (() => {
    const done = sets.filter(s => s.done && s.rir !== null);
    if (!done.length) return null;
    return (done.reduce((a, b) => a + b.rir, 0) / done.length).toFixed(1);
  })();

  const hasRir0 = sets.filter(s => s.done && s.rir === 0).length > 1;

  // Descanso efectivo: el de esta sesión → el de la sesión anterior → default por tipo
  const effectiveRest = data.restTime ?? lastData?.restTime ?? REST_DEFAULTS[type] ?? 60;

  function updateSet(i, field, val) {
    const updated = sets.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    onUpdate({ ...data, sets: updated });
  }

  function addSet() {
    // A mitad del ejercicio lo predecible es seguir con la carga que ya estás
    // usando; recién si no hay ninguna se recurre a la sesión anterior.
    const fromPrev = sets[sets.length - 1];
    const fromLast = lastSets[sets.length] ?? lastSets[lastSets.length - 1];
    const src = (fromPrev?.weight ? fromPrev : fromLast) || {};
    onUpdate({ ...data, sets: [...sets, { ...makeEmptySet(), weight: src.weight || "", reps: src.reps || "" }] });
  }

  function removeSet(i) {
    if (sets.length <= 1) return;
    onUpdate({ ...data, sets: sets.filter((_, idx) => idx !== i) });
  }

  function markDone(i) {
    const s = sets[i];
    const newDone = !s.done;
    // doneAt es lo que permite armar el informe en el orden real en que
    // entrenaste, y no en el orden en que la rutina lista los ejercicios.
    const updated = sets.map((set, idx) =>
      idx === i ? { ...set, done: newDone, doneAt: newDone ? Date.now() : null } : set
    );
    if (newDone) {
      // Fija restTime en la sesión al usarlo, así la próxima sesión lo hereda
      onUpdate({ ...data, sets: updated, restTime: effectiveRest });
      onStartRest(effectiveRest, name, type);
    } else {
      onUpdate({ ...data, sets: updated });
    }
  }

  const totalVol = sets
    .filter(s => s.done)
    .reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);

  async function toggleChart() {
    const opening = !showChart;
    setShowChart(opening);
    if (!opening || historyState !== "idle" || !loadHistory) return;
    setHistoryState("loading");
    try {
      setHistory(await loadHistory(name));
      setHistoryState("ready");
    } catch (err) {
      console.error("Error cargando historial:", err);
      // La consulta del historial necesita un índice compuesto (uid + dateKey).
      // Si falta, Firestore devuelve el link para crearlo dentro del mensaje:
      // lo mostramos en vez de dejar al usuario buscándolo en la consola.
      if (err?.code === "failed-precondition") {
        setIndexUrl(err.message.match(/https:\/\/\S+/)?.[0]?.replace(/[).]+$/, "") ?? null);
      }
      setHistoryState("error");
    }
  }

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
          {/* Los separadores "·" iban dentro de cada span y quedaban huérfanos al
              principio de la línea cuando el nombre del ejercicio forzaba el wrap. */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#888", letterSpacing: "1px", textTransform: "uppercase" }}>{type}</span>
            {totalVol > 0 && <span style={{ fontSize: "12px", color: "#888" }}>{totalVol}kg vol</span>}
            {target && (
              <span style={{ fontSize: "12px", color: "#3b82f6", letterSpacing: "0.5px" }}>
                Obj: {target.series}×
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
                background: "transparent", border: "none", color: "#888",
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

      {/* Last session + progression suggestion */}
      {lastSets.length > 0 && (
        <div style={{ fontSize: "12px", marginBottom: "10px", padding: "8px 10px", background: "#0d0d0d", borderRadius: "6px", letterSpacing: "0.5px" }}>
          <div style={{ color: "#888" }}>
            Anterior: {lastSets.length}×{lastSets[0]?.reps}@{lastSets[0]?.weight}kg
            {lastSets[0]?.rir !== null && ` · RIR ${lastSets[0]?.rir}`}
          </div>
          {suggestion && (
            <div style={{ color: SUGGESTION_COLOR[suggestion.action], marginTop: "5px" }}>
              → Hoy: {suggestion.weight}kg × {suggestion.reps} · {suggestion.reason}
            </div>
          )}
          {record.isRecord ? (
            <div style={{ color: "#22c55e", marginTop: "5px" }}>
              ★ RÉCORD: {formatMark(record.current)}
              {record.previous && ` · antes ${roundKg(record.previous.e1rm)}kg`}
            </div>
          ) : record.previous && (
            <div style={{ color: "#888", marginTop: "5px" }}>
              Récord: {formatMark(record.previous)}
            </div>
          )}
          {!record.isRecord && stagnation && (
            <div style={{ color: "#eab308", marginTop: "5px" }}>
              ⚠ {stagnationLabel(stagnation)}
            </div>
          )}
        </div>
      )}

      {/* Sin sesión anterior el bloque de referencia no se dibuja, pero el
          récord sigue siendo información útil. */}
      {lastSets.length === 0 && (record.isRecord || record.previous) && (
        <div style={{ fontSize: "12px", marginBottom: "10px", padding: "8px 10px", background: "#0d0d0d", borderRadius: "6px", letterSpacing: "0.5px", color: record.isRecord ? "#22c55e" : "#888" }}>
          {record.isRecord
            ? `★ RÉCORD: ${formatMark(record.current)}`
            : `Récord: ${formatMark(record.previous)}`}
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 44px", gap: "6px", paddingBottom: "6px", color: "#888", fontSize: "11px", letterSpacing: "1.5px" }}>
        <div />
        <div style={{ textAlign: "center" }}>PESO</div>
        <div style={{ textAlign: "center" }}>REPS</div>
        <div />
      </div>

      {/* Sets */}
      {sets.map((s, i) => (
        <div key={i} style={{ marginBottom: "12px", opacity: s.done ? 0.55 : 1, transition: "opacity 0.2s ease-out" }}>
          {/* Row 1: done + inputs + delete */}
          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 44px", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
            <button onClick={() => markDone(i)}
              style={{
                width: "44px", height: "44px", borderRadius: "50%",
                border: `2px solid ${s.done ? "#22c55e" : "#444"}`,
                background: s.done ? "#22c55e" : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, padding: 0,
                transition: "background 0.2s ease-out, border-color 0.2s ease-out, transform 120ms ease-out",
              }}>
              {/* Blanco sobre el verde de completado da 2.3:1; el tilde calado en
                  el color del fondo llega a 9.2:1 y repite el patrón de inversión
                  que ya usa el día activo. */}
              {s.done && <span style={{ fontSize: "18px", color: "#0a0a0a", lineHeight: 1 }}>✓</span>}
            </button>

            <input type="number" inputMode="decimal" placeholder="kg" value={s.weight}
              onChange={e => updateSet(i, "weight", e.target.value)}
              aria-label={`Peso serie ${i + 1}`}
              style={inputSt} />

            <input type="number" inputMode="numeric" placeholder="reps" value={s.reps}
              onChange={e => updateSet(i, "reps", e.target.value)}
              aria-label={`Repeticiones serie ${i + 1}`}
              style={inputSt} />

            <button onClick={() => removeSet(i)}
              aria-label={`Eliminar serie ${i + 1}`}
              style={{ background: "transparent", border: "none", color: "#888", fontSize: "22px", cursor: "pointer", padding: 0, width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ×
            </button>
          </div>

          {/* Row 2: escalas RIR y fatiga, una fila cada una. Lado a lado, cinco
              pills en media tarjeta caían a 25px de ancho — por debajo del
              mínimo táctil que pide PRODUCT.md. A fila completa llegan a ~50px.
              La etiqueta va fija a la izquierda: apiladas, dos filas de cinco
              pills sin rótulo son indistinguibles entre sí. */}
          {[
            { key: "rir", label: "RIR", values: [0, 1, 2, 3, 4], config: RIR_CONFIG, current: s.rir },
            { key: "fatigue", label: "FAT", values: [1, 2, 3, 4, 5], config: FATIGUE_CONFIG, current: s.fatigue },
          ].map(scale => (
            <div key={scale.key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", color: "#888", letterSpacing: "1.5px", width: "30px", flexShrink: 0 }}>
                {scale.label}
              </span>
              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                {scale.values.map(v => (
                  <button key={v}
                    onClick={() => updateSet(i, scale.key, scale.current === v ? null : v)}
                    aria-pressed={scale.current === v}
                    aria-label={`Serie ${i + 1}, ${scale.label === "RIR" ? "RIR" : "fatiga"} ${v === 4 && scale.key === "rir" ? "4 o más" : v}: ${scale.config[v].desc}`}
                    style={{
                      ...btnSt,
                      background: scale.current === v ? scale.config[v].bg : "transparent",
                      color: scale.current === v ? scale.config[v].text : "#888",
                      borderColor: scale.current === v ? scale.config[v].bg : "#333",
                    }}>
                    {scale.config[v].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Add set */}
      <button onClick={() => addSet()}
        style={{
          background: "transparent", border: "1px dashed #333", color: "#888",
          borderRadius: "6px", minHeight: "44px", width: "100%",
          fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px", cursor: "pointer",
          marginBottom: "12px",
        }}>
        + SERIE
      </button>

      {/* Rest time */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", color: "#888", letterSpacing: "1px" }}>DESCANSO</span>
        <input
          type="number"
          inputMode="numeric"
          value={effectiveRest}
          onChange={e => onUpdate({ ...data, restTime: parseInt(e.target.value) || 60 })}
          aria-label={`Descanso de ${name} en segundos`}
          style={{ ...inputSt, width: "72px" }}
        />
        <span style={{ fontSize: "12px", color: "#888" }}>seg</span>
      </div>

      {/* Secondary actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <button onClick={() => setShowNotes(!showNotes)}
          style={{ ...subtleBtn, color: "#888", textAlign: "left", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.notes ? `📝 ${data.notes.slice(0, 40)}${data.notes.length > 40 ? "…" : ""}` : "+ nota del ejercicio"}
        </button>
        <button onClick={toggleChart}
          style={{ ...subtleBtn, color: "#888", flexShrink: 0 }}
          aria-expanded={showChart}>
          {showChart ? "▾ progreso" : "▸ progreso"}
        </button>
      </div>

      {showChart && (
        <div style={{ marginTop: "8px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px" }}>
          {historyState === "loading" && (
            <div style={{ textAlign: "center", padding: "30px", color: "#333", fontSize: "11px", letterSpacing: "1px" }}>CARGANDO…</div>
          )}
          {historyState === "error" && (
            <div style={{ textAlign: "center", padding: "24px 12px", fontSize: "11px", letterSpacing: "1px", lineHeight: 1.8 }}>
              <div style={{ color: "#7f1d1d" }}>NO SE PUDO CARGAR EL HISTORIAL</div>
              {indexUrl && (
                <a href={indexUrl} target="_blank" rel="noreferrer"
                  style={{ color: "#3b82f6", textDecoration: "underline", display: "inline-block", padding: "8px 0" }}>
                  CREAR EL ÍNDICE EN FIREBASE →
                </a>
              )}
            </div>
          )}
          {historyState === "ready" && <ProgressionChart history={history} exerciseName={name} />}
        </div>
      )}

      {showNotes && (
        <textarea
          value={data.notes || ""}
          onChange={e => onUpdate({ ...data, notes: e.target.value })}
          placeholder="Ej: usé máquina libre, bajé peso por fatiga..."
          rows={2}
          style={{
            width: "100%", marginTop: "8px", background: "#0f0f0f",
            border: "1px solid #1e1e1e", color: "#ccc", padding: "10px 12px",
            borderRadius: "6px", fontFamily: "'DM Mono'", fontSize: "16px",
            resize: "none", outline: "none",
          }}
        />
      )}
    </div>
  );
}

// 44px de alto: peso y reps son los controles más tocados de la app y quedaban
// en 40. 16px de fuente además evita el zoom automático de Safari en iOS.
const inputSt = {
  background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#f0f0f0",
  padding: "10px 8px", minHeight: "44px", borderRadius: "6px", fontFamily: "'DM Mono'",
  fontSize: "16px", outline: "none", width: "100%", textAlign: "center",
};

// Acciones secundarias de la tarjeta: discretas, pero con el target táctil de
// 44px que exige usarlas con el teléfono en la mano entre series.
const subtleBtn = {
  background: "transparent", border: "none", fontSize: "13px",
  fontFamily: "'DM Mono'", cursor: "pointer", letterSpacing: "0.5px",
  padding: "4px 0", minHeight: "44px",
};

// DESIGN.md marca las pills de RIR como target crítico: se tocan una vez por
// serie con la mano cansada. Estaban en 34px de alto.
const btnSt = {
  border: "1px solid", borderRadius: "5px", padding: "0 2px", minHeight: "44px",
  fontSize: "13px", cursor: "pointer", fontFamily: "'DM Mono'",
  transition: "transform 120ms ease-out", flex: 1, textAlign: "center",
};
