import { useState, useRef, useEffect } from "react";

export default function TargetRow({ name, target, onChange, onRemove }) {
  const [editing, setEditing] = useState(null); // 'series' | 'reps' | 'peso'
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const vals = {
    series: target?.series ?? null,
    reps: target?.reps_por_serie ? target.reps_por_serie[0] : (target?.reps ?? null),
    peso: target?.peso ?? null,
  };

  const hasTarget = vals.series != null || vals.reps != null || vals.peso != null;

  function startEdit(field) {
    setEditing(field);
    setDraft(vals[field] != null ? String(vals[field]) : "");
  }

  function commit() {
    if (editing === null) return;
    const raw = draft.trim();
    const num = parseFloat(raw);
    const updated = {
      series: vals.series,
      reps: vals.reps,
      peso: vals.peso,
      [editing]: raw === "" || isNaN(num) ? null : num,
    };
    if (Object.values(updated).every(v => v === null)) {
      onRemove();
    } else {
      onChange(updated);
    }
    setEditing(null);
  }

  function handleKey(e) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") setEditing(null);
  }

  function cell(field) {
    const val = vals[field];
    const isActive = editing === field;
    const width = field === "peso" ? "64px" : "46px";

    if (isActive) {
      return (
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          style={{
            width,
            height: "44px",
            background: "#0f0f0f",
            border: "1px solid #3b82f6",
            borderRadius: "6px",
            color: "#f0f0f0",
            fontFamily: "'DM Mono', monospace",
            fontSize: "16px",
            textAlign: "center",
            padding: "0 4px",
            outline: "none",
          }}
        />
      );
    }

    return (
      <button
        onClick={() => startEdit(field)}
        style={{
          background: "transparent",
          border: "none",
          borderBottom: `1px dashed ${val != null ? "#1a3d70" : "#222"}`,
          color: val != null ? "#3b82f6" : "#383838",
          fontFamily: "'DM Mono', monospace",
          fontSize: "16px",
          cursor: "pointer",
          padding: "0 4px",
          height: "44px",
          width,
          textAlign: "center",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 120ms ease-out",
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label={`Editar ${field} de ${name}`}
      >
        {val != null ? val : "—"}
      </button>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "4px 0",
      borderBottom: "1px solid #1a1a1a",
      gap: "8px",
      minHeight: "54px",
    }}>
      <span style={{
        color: "#aaaaaa",
        fontSize: "14px",
        fontFamily: "'DM Mono', monospace",
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        letterSpacing: "0.3px",
      }}>
        {name}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
        {cell("series")}
        <span style={sepSt}>×</span>
        {cell("reps")}
        <span style={sepSt}>@</span>
        {cell("peso")}
        <span style={{ color: "#444", fontSize: "13px", fontFamily: "'DM Mono', monospace", marginLeft: "2px", userSelect: "none" }}>kg</span>

        <button
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "none",
            color: "#3a3a3a",
            fontSize: "16px",
            cursor: "pointer",
            marginLeft: "6px",
            padding: "0 4px",
            height: "44px",
            minWidth: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Mono'",
            opacity: hasTarget ? 1 : 0,
            pointerEvents: hasTarget ? "auto" : "none",
            transition: "opacity 150ms ease-out",
          }}
          tabIndex={hasTarget ? 0 : -1}
          aria-label={`Eliminar objetivo de ${name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const sepSt = {
  color: "#444",
  fontSize: "14px",
  fontFamily: "'DM Mono', monospace",
  padding: "0 2px",
  userSelect: "none",
  lineHeight: 1,
  flexShrink: 0,
};
