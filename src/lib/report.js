import { DAYS, RIR_CONFIG, FATIGUE_CONFIG, sortedExercises } from "./constants";
import { recordStatus, formatMark } from "./records";
import { stagnationLabel } from "./stagnation";

// Momento en que se registró la primera serie del ejercicio. null en sesiones
// anteriores a que se guardara doneAt.
function firstDoneAt(exData) {
  const stamps = (exData?.sets || [])
    .filter(s => s.done && typeof s.doneAt === "number")
    .map(s => s.doneAt);
  return stamps.length ? Math.min(...stamps) : null;
}

/**
 * Ejercicios en el orden real en que se entrenaron. Los que no tienen marca de
 * tiempo (sesiones viejas) conservan el orden de la rutina: sort es estable, así
 * que devolver 0 mantiene el orden de entrada, y van después de los fechados.
 */
function inTrainedOrder(session, dayKey) {
  return sortedExercises(session?.exercises, dayKey).sort((a, b) => {
    const at = firstDoneAt(a[1]);
    const bt = firstDoneAt(b[1]);
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return at - bt;
  });
}

export function generateReport({ session, lastSession, dayKey, dateKey, sessionDuration, userName, bests, stagnations }) {
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

  // Per exercise, en el orden en que se entrenaron
  inTrainedOrder(session, dayKey).forEach(([exName, exData]) => {
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

    // El récord es lo que convierte el informe en algo accionable para quien
    // lo lea después: dice si la sesión movió el techo o solo lo sostuvo.
    const rec = recordStatus(sets, bests?.[exName]);
    if (rec.isRecord) {
      lines.push(`  ★ RÉCORD: ${formatMark(rec.current)} (anterior ${formatMark(rec.previous)})`);
    } else if (rec.current) {
      lines.push(`  1RM estimado: ${Math.round(rec.current.e1rm * 2) / 2}kg`);
    }

    // El estancamiento es justamente lo que se quiere ver al leer el informe
    // después: qué ejercicios llevan semanas sin moverse y en qué condiciones.
    const stag = stagnations?.[exName];
    if (stag && !rec.isRecord) {
      lines.push(`  ⚠ ${stagnationLabel(stag)} (récord del ${stag.bestDate})`);
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
