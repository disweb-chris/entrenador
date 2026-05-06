export default function ProgressionChart({ history, exerciseName }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ textAlign: "center", padding: "30px", color: "#333", fontSize: "11px", letterSpacing: "1px" }}>
        SIN SUFICIENTE HISTORIAL
      </div>
    );
  }

  const maxW = Math.max(...history.map(h => h.maxWeight));
  const minW = Math.min(...history.map(h => h.maxWeight));
  const range = maxW - minW || 1;

  const W = 300, H = 100, PAD = 20;
  const pts = history.map((h, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((h.maxWeight - minW) / range) * (H - PAD * 2);
    return { x, y, ...h };
  });

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;

  return (
    <div style={{ fontFamily: "'DM Mono', monospace" }}>
      <div style={{ fontSize: "11px", color: "#555", letterSpacing: "1px", marginBottom: "8px" }}>
        {exerciseName.toUpperCase()}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.5, 1].map(f => (
          <line key={f}
            x1={PAD} y1={PAD + f * (H - PAD * 2)}
            x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
            stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {/* Area */}
        <path d={areaD} fill="url(#chartGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#0a0a0a" stroke="#22c55e" strokeWidth="2" />
            {i === pts.length - 1 && (
              <text x={p.x} y={p.y - 8} textAnchor="middle"
                style={{ fontFamily: "'DM Mono'", fontSize: "9px", fill: "#22c55e" }}>
                {p.maxWeight}kg
              </text>
            )}
          </g>
        ))}
        {/* Labels */}
        <text x={PAD} y={H - 4} style={{ fontFamily: "'DM Mono'", fontSize: "8px", fill: "#333" }}>
          {pts[0]?.date?.slice(5)}
        </text>
        <text x={W - PAD} y={H - 4} textAnchor="end" style={{ fontFamily: "'DM Mono'", fontSize: "8px", fill: "#333" }}>
          {pts[pts.length - 1]?.date?.slice(5)}
        </text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#444", marginTop: "4px" }}>
        <span>Mín: {minW}kg</span>
        <span>Máx: {maxW}kg</span>
        <span>+{(maxW - minW).toFixed(1)}kg total</span>
      </div>
    </div>
  );
}
