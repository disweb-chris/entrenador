// Récords y 1RM estimado. La app venía registrando todo esto sin devolver nada:
// el 1RM estimado es lo que permite comparar una serie de 5×100 con una de 8×90,
// que en peso bruto no son comparables.

// Epley. Como estimación absoluta pierde precisión pasadas las ~12 reps, pero
// acá sólo se compara un ejercicio contra sí mismo, y para eso lo que importa
// es que sea monótona: subir de 10×10 a 10×13 tiene que leerse como progreso.
// Cortar en 12 descartaba justo las mejores series de quien progresa sumando
// repeticiones. El corte queda en 20, donde la fórmula deja de significar algo
// y además empiezan los ejercicios de tiempo anotados como reps (planchas).
const MAX_REPS = 20;

export function estimate1RM(weight, reps) {
  const w = parseFloat(weight);
  const r = parseInt(reps);
  if (!w || !r || w <= 0 || r < 1 || r > MAX_REPS) return null;
  // Una sola repetición ya ES el máximo: aplicarle la fórmula lo infla un 3.3%
  // y bastaría para anunciar un récord que no ocurrió.
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export function roundKg(n) {
  return Math.round(n * 2) / 2;
}

/** La serie más fuerte de una lista, medida por 1RM estimado. */
export function bestSet(sets) {
  let best = null;
  for (const s of sets || []) {
    if (!s.done) continue;
    const e1rm = estimate1RM(s.weight, s.reps);
    if (e1rm === null) continue;
    if (!best || e1rm > best.e1rm) {
      best = { e1rm, weight: parseFloat(s.weight), reps: parseInt(s.reps) };
    }
  }
  return best;
}

/**
 * Mejor marca histórica por ejercicio a partir de las sesiones crudas.
 * `excludeDateKey` deja fuera la sesión en curso: de lo contrario cada serie
 * que registrás se compara contra sí misma y nunca hay récord.
 */
export function computeBests(sessions, excludeDateKey = null) {
  const bests = {};
  for (const session of sessions || []) {
    if (!session || session.dateKey === excludeDateKey) continue;
    for (const [name, data] of Object.entries(session.exercises || {})) {
      const best = bestSet(data?.sets);
      if (!best) continue;
      if (!bests[name] || best.e1rm > bests[name].e1rm) {
        bests[name] = { ...best, dateKey: session.dateKey };
      }
    }
  }
  return bests;
}

/**
 * Estado de récord de un ejercicio en la sesión actual.
 * Sin marca previa, la primera serie válida no se anuncia como récord: todo
 * sería récord la primera semana y la señal dejaría de significar algo.
 */
export function recordStatus(currentSets, previousBest) {
  const current = bestSet(currentSets);
  if (!current) return { current: null, previous: previousBest ?? null, isRecord: false };
  const isRecord = !!previousBest && current.e1rm > previousBest.e1rm;
  return { current, previous: previousBest ?? null, isRecord };
}

/** "82.5kg × 8 · 1RM 104kg" */
export function formatMark(mark) {
  if (!mark) return null;
  return `${roundKg(mark.weight)}kg × ${mark.reps} · 1RM ${roundKg(mark.e1rm)}kg`;
}
