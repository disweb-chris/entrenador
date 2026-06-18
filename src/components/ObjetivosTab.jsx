import { useState, useMemo, useRef, useEffect } from "react";
import TargetRow from "./TargetRow";

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSpec(spec) {
  if (!spec) return null;
  const s = spec.trim();

  // "3x8@80kg", "3x8 @ 80.5", "3×8@80"
  const m1 = s.match(/^(\d+)\s*[x×X]\s*(\d+)(?:\s*[@a]\s*([\d.]+))?/i);
  if (m1) {
    return {
      series: parseInt(m1[1]),
      reps: parseInt(m1[2]),
      peso: m1[3] ? parseFloat(m1[3]) : null,
    };
  }

  // "3 series de 8 reps con 80kg"  /  "3 series x 8 a 80kg"
  const m2 = s.match(/(\d+)\s*series?\s*(?:de|x|×|por)?\s*(\d+)\s*(?:reps?)?\s*(?:con|@|a|de)\s*([\d.]+)/i);
  if (m2) {
    return {
      series: parseInt(m2[1]),
      reps: parseInt(m2[2]),
      peso: parseFloat(m2[3]),
    };
  }

  // "3 series de 8" (no weight)
  const m3 = s.match(/(\d+)\s*series?\s*(?:de|x|×|por)?\s*(\d+)\s*(?:reps?)?/i);
  if (m3) {
    return {
      series: parseInt(m3[1]),
      reps: parseInt(m3[2]),
      peso: null,
    };
  }

  return null;
}

function parseTargetText(raw) {
  const text = raw.trim();
  if (!text) return { items: [], errors: [] };

  // JSON path
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const items = [];
        const errors = [];
        for (const [name, val] of Object.entries(obj)) {
          const n = name.trim();
          if (!n) continue;
          if (!val || typeof val !== "object") {
            errors.push(`"${n}": valor no reconocido`);
            continue;
          }
          const series = val.series ?? val.sets ?? null;
          const reps = val.reps ?? (Array.isArray(val.reps_por_serie) ? val.reps_por_serie[0] : null) ?? null;
          const peso = val.peso ?? val.weight ?? val.kg ?? null;
          items.push({
            name: n,
            target: {
              series: series != null ? Number(series) : null,
              reps: reps != null ? Number(reps) : null,
              peso: peso != null ? Number(peso) : null,
            },
          });
        }
        return { items, errors };
      }
    } catch {}
  }

  // Line-by-line path
  const items = [];
  const errors = [];

  for (let line of text.split("\n")) {
    line = line.trim().replace(/^[-*•]\s*/, ""); // strip markdown bullets
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Try "Name 3x8@80kg" (no colon)
      const m = line.match(/^(.+?)\s+(\d+\s*[x×X]\s*\d+.*)$/i);
      if (m) {
        const parsed = parseSpec(m[2]);
        if (parsed) { items.push({ name: m[1].trim(), target: parsed }); continue; }
      }
      errors.push(`Sin separador: "${line}"`);
      continue;
    }

    const name = line.slice(0, colonIdx).trim();
    const spec = line.slice(colonIdx + 1).trim();

    if (!name) { errors.push(`Nombre vacío: "${line}"`); continue; }

    const parsed = parseSpec(spec);
    if (parsed) {
      items.push({ name, target: parsed });
    } else {
      errors.push(`"${name}": no reconocido ("${spec}")`);
    }
  }

  return { items, errors };
}

function targetLabel(t) {
  if (!t) return "—";
  const parts = [];
  if (t.series != null) parts.push(t.series);
  if (t.reps != null) parts.push(`×${t.reps}`);
  if (t.peso != null) parts.push(`@${t.peso}kg`);
  return parts.join("") || "—";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ObjetivosTab({
  session,
  targets,
  activeDay,
  weekKey,
  onTargetChange,
  onTargetRemove,
  onTargetsMerge,
}) {
  const [mode, setMode] = useState("edit");
  const [pasteText, setPasteText] = useState("");
  const [applyStatus, setApplyStatus] = useState(null); // null | "ok" | "partial" | "error"
  const [applyMsg, setApplyMsg] = useState("");
  const applyTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const parseResult = useMemo(() => parseTargetText(pasteText), [pasteText]);
  const hasItems = parseResult.items.length > 0;

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
    const newTargets = {};
    for (const { name, target } of parseResult.items) newTargets[name] = target;
    onTargetsMerge(newTargets);

    const n = parseResult.items.length;
    const e = parseResult.errors.length;

    if (e === 0) {
      setApplyStatus("ok");
      setApplyMsg(`✓ ${n} ${n === 1 ? "ejercicio" : "ejercicios"} aplicados`);
      applyTimerRef.current = setTimeout(() => {
        switchMode("edit");
      }, 1400);
    } else {
      setApplyStatus("partial");
      setApplyMsg(`${n} aplicados · ${e} con error`);
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

  const exerciseNames = Object.keys(session.exercises);

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
            placeholder={"Pegá el texto de Claude:\n\nPress Plano: 3x8@80kg\nSentadilla: 4x5@100kg\nPeso Muerto: 3x8\n\nTambién acepta JSON."}
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
              {parseResult.items.map(({ name, target }) => (
                <div key={name} style={{
                  display: "flex", gap: "8px", alignItems: "baseline",
                  marginBottom: "4px", lineHeight: 1.4,
                }}>
                  <span style={{ color: "#22c55e", fontSize: "11px", flexShrink: 0 }}>✓</span>
                  <span style={{ color: "#cccccc", fontSize: "13px", fontFamily: "'DM Mono', monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  <span style={{ color: "#3b82f6", fontSize: "13px", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {targetLabel(target)}
                  </span>
                </div>
              ))}
              {parseResult.errors.map((err, i) => (
                <div key={i} style={{
                  display: "flex", gap: "8px", alignItems: "baseline",
                  marginBottom: "4px", lineHeight: 1.4,
                }}>
                  <span style={{ color: "#ef4444", fontSize: "11px", flexShrink: 0 }}>✗</span>
                  <span style={{ color: "#555", fontSize: "12px", fontFamily: "'DM Mono', monospace" }}>
                    {err}
                  </span>
                </div>
              ))}
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
              {hasItems ? `APLICAR (${parseResult.items.length})` : "APLICAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
