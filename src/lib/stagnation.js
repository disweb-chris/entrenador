import { bestSet } from "./records";

// Detección de estancamiento: la contraparte de la sugerencia de peso. La app
// ya dice qué cargar hoy, pero no avisaba cuando un ejercicio lleva semanas sin
// moverse — que es justo cuando hay que cambiar algo.

/**
 * Progresión de un ejercicio a lo largo de las sesiones, de la más vieja a la
 * más nueva. Sólo entran las sesiones donde el ejercicio tiene series
 * completadas: una sesión abierta y no entrenada no interrumpe una racha.
 */
export function exerciseTimeline(exerciseName, sessions) {
  const points = [];
  for (const s of sessions || []) {
    const data = s?.exercises?.[exerciseName];
    const best = bestSet(data?.sets);
    if (!best) continue;
    const rirs = (data.sets || [])
      .filter(x => x.done && x.rir !== null && x.rir !== undefined)
      .map(x => x.rir);
    points.push({
      dateKey: s.dateKey || "",
      e1rm: best.e1rm,
      avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
    });
  }
  return points.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/**
 * Cuántas sesiones pasaron desde la mejor marca del ejercicio, y en qué
 * condiciones. Devuelve null si no hay estancamiento o no hay historial
 * suficiente para afirmarlo.
 *
 * El RIR de esas sesiones distingue dos situaciones que piden lo contrario:
 * estancarse yendo al fallo sugiere bajar la carga; estancarse con margen de
 * sobra sugiere que hay lugar para subir.
 */
export function stagnationStatus(exerciseName, sessions, { threshold = 3 } = {}) {
  const line = exerciseTimeline(exerciseName, sessions);
  // Hace falta la sesión del récord más `threshold` posteriores.
  if (line.length < threshold + 1) return null;

  let bestIdx = 0;
  for (let i = 1; i < line.length; i++) {
    if (line[i].e1rm > line[bestIdx].e1rm) bestIdx = i;
  }
  const since = line.length - 1 - bestIdx;
  if (since < threshold) return null;

  const after = line.slice(bestIdx + 1);
  const rirs = after.map(p => p.avgRir).filter(r => r !== null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;

  return {
    since,
    avgRir,
    bestDate: line[bestIdx].dateKey,
    // Sin RIR registrado no se opina sobre la causa, sólo sobre el hecho.
    action: avgRir === null ? "unknown" : avgRir <= 1 ? "deload" : "push",
  };
}

/** Texto para la tarjeta y el informe. Directo, sin consejo motivacional. */
export function stagnationLabel(status) {
  if (!status) return null;
  const n = `${status.since} ${status.since === 1 ? "sesión" : "sesiones"} sin superar el récord`;
  if (status.action === "deload") return `${n}, yendo al fallo`;
  if (status.action === "push") return `${n}, con RIR de sobra`;
  return n;
}
