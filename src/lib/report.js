import { DAYS, RIR_CONFIG, FATIGUE_CONFIG } from "./constants";

export function generateReport({ session, lastSession, dayKey, dateKey, sessionDuration, userName }) {
  const dayInfo = DAYS.find(d => d.key === dayKey);
  const lines = [];

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`INFORME DE SESIÓN — OVERLOAD`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Usuario: ${userName}`);
  lines.push(`Día: ${dayInfo?.full} (${dayInfo?.focus})`);
  lines.push(`Fecha: ${dateKey}`);
  lines.push(`Duración: ${sessionDuration}`);

  // Session notes
  if (session?.sessionNotes) {
    lines.push(`Notas generales: ${session.sessionNotes}`);
  }

  lines.push(``);

  // Compute totals
  let totalVol = 0;
  let totalSets = 0;
  let doneSets = 0;

  Object.entries(session?.exercises || {}).forEach(([exName, exData]) => {
    const sets = exData.sets || [];
    const done = sets.filter(s => s.done);
    totalSets += sets.length;
    doneSets += done.length;
    done.forEach(s => {
      totalVol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
    });
  });

  lines.push(`Volumen total: ${totalVol.toLocaleString()} kg`);
  lines.push(`Series completadas: ${doneSets}/${totalSets}`);
  lines.push(``);
  lines.push(`────────────────────────────`);

  // Per exercise
  Object.entries(session.exercises || {}).forEach(([exName, exData]) => {
    const sets = exData.sets || [];
    const done = sets.filter(s => s.done);
    if (!done.length) return;

    lines.push(``);
    lines.push(`▸ ${exName}`);

    // Compare with last session
    const lastEx = lastSession?.exercises?.[exName];
    if (lastEx) {
      const lastDone = (lastEx.sets || []).filter(s => s.done);
      if (lastDone.length) {
        const lastW = lastDone[0]?.weight || "?";
        const lastR = lastDone[0]?.reps || "?";
        lines.push(`  Sesión anterior: ${lastDone.length}×${lastR} @ ${lastW}kg`);
      }
    }

    done.forEach((s, i) => {
      const rirLabel = s.rir !== null ? `RIR ${s.rir === 4 ? "4+" : s.rir}` : "RIR —";
      const rirDesc = s.rir !== null ? ` (${RIR_CONFIG[s.rir]?.desc || ""})` : "";
      const fatLabel = s.fatigue !== null ? `Fatiga ${s.fatigue}` : "Fatiga —";
      const fatDesc = s.fatigue !== null ? ` (${FATIGUE_CONFIG[s.fatigue]?.desc || ""})` : "";
      const noteStr = s.notes ? ` → "${s.notes}"` : "";
      lines.push(`  S${i + 1}: ${s.weight}kg × ${s.reps} reps | ${rirLabel}${rirDesc} | ${fatLabel}${fatDesc}${noteStr}`);
    });

    if (exData.notes) {
      lines.push(`  📝 ${exData.notes}`);
    }

    // RIR 0 flag
    const rir0count = done.filter(s => s.rir === 0).length;
    if (rir0count > 0) {
      lines.push(`  ⚠️ ${rir0count} serie(s) en RIR 0 — mantener peso próxima sesión`);
    }
  });

  lines.push(``);
  lines.push(`────────────────────────────`);
  lines.push(`FIN DEL INFORME`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join("\n");
}

export function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
