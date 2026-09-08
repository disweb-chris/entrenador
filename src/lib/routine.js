import { DAYS, DEFAULT_EXERCISES, REST_DEFAULTS, makeEmptySet } from "./constants";

// La rutina vivía hardcodeada en DEFAULT_EXERCISES: cambiar un ejercicio, el
// orden o un descanso de forma permanente exigía tocar código y desplegar. Acá
// pasa a ser un dato del usuario, y DEFAULT_EXERCISES queda sólo como semilla.
//
// Forma:
//   { lunes: { foco: "Piernas + Abs", ejercicios: [ {nombre, tipo, descanso, notas} ] } }
//
// El orden de `ejercicios` ES el orden de la rutina. No hay campo `orden`: un
// índice explícito es lo primero que se desincroniza cuando el JSON se edita
// a mano.

export function defaultRoutine() {
  const days = {};
  for (const d of DAYS) {
    days[d.key] = {
      foco: d.focus,
      ejercicios: (DEFAULT_EXERCISES[d.key] || []).map(ex => ({
        nombre: ex.name,
        tipo: ex.type,
        descanso: REST_DEFAULTS[ex.type] ?? 60,
        notas: "",
      })),
    };
  }
  return days;
}

/**
 * Rutina inicial para quien todavía no tiene una guardada. La sesión más
 * reciente de cada día ES su rutina en la práctica: tiene el orden real, los
 * descansos ajustados en el gimnasio y los ejercicios agregados a mano, cosas
 * que DEFAULT_EXERCISES no sabe. Sembrar desde el código perdería todo eso.
 */
export function seedRoutine(recentSessions) {
  const days = defaultRoutine();
  const newestByDay = new Map();
  for (const s of recentSessions || []) {
    if (!s?.dayKey || !s.exercises) continue;
    const prev = newestByDay.get(s.dayKey);
    if (!prev || (s.dateKey || "") > (prev.dateKey || "")) newestByDay.set(s.dayKey, s);
  }

  for (const [dayKey, session] of newestByDay) {
    if (!days[dayKey]) continue;
    const ejercicios = routineDayFromSession(session, days[dayKey]);
    if (ejercicios.length) days[dayKey] = { ...days[dayKey], ejercicios };
  }
  return days;
}

/** Completa los días que falten para que la rutina siempre cubra la semana. */
export function withDefaults(days) {
  const base = defaultRoutine();
  if (!days) return base;
  const out = {};
  for (const d of DAYS) {
    const stored = days[d.key];
    out[d.key] = stored?.ejercicios?.length ? stored : base[d.key];
  }
  return out;
}

/**
 * Ejercicios de una sesión nueva a partir de la rutina.
 *
 * El descanso sale de la rutina, pero si la sesión anterior tenía otro se
 * respeta ese: ajustarlo en el gimnasio no debería perderse a la semana
 * siguiente. Las series se pre-crean según el objetivo — arrancar siempre en
 * una y tocar "+ SERIE" dos veces por ejercicio son ~20 taps por sesión.
 */
export function sessionExercisesFromRoutine(dayRoutine, { lastSession, targets } = {}) {
  const exercises = {};
  (dayRoutine?.ejercicios || []).forEach((ex, idx) => {
    const prev = lastSession?.exercises?.[ex.nombre];
    const series = Math.min(Math.max(parseInt(targets?.[ex.nombre]?.series) || 1, 1), 10);
    exercises[ex.nombre] = {
      type: ex.tipo || "isolation",
      order: idx,
      notes: ex.notas || "",
      restTime: prev?.restTime ?? ex.descanso ?? REST_DEFAULTS[ex.tipo] ?? 60,
      sets: Array.from({ length: series }, makeEmptySet),
    };
  });
  return exercises;
}

/** Rutina de un día a partir de una sesión, para poder exportarla como JSON. */
export function routineDayFromSession(session, dayRoutine) {
  const known = new Map((dayRoutine?.ejercicios || []).map(e => [e.nombre, e]));
  return Object.entries(session?.exercises || {})
    .sort(([, a], [, b]) => (a?.order ?? 0) - (b?.order ?? 0))
    .map(([nombre, data]) => ({
      nombre,
      tipo: data.type || known.get(nombre)?.tipo || "isolation",
      descanso: data.restTime ?? known.get(nombre)?.descanso ?? REST_DEFAULTS[data.type] ?? 60,
      notas: known.get(nombre)?.notas || "",
    }));
}

/**
 * Qué cambia al aplicar una rutina nueva sobre la vigente. Alimenta el preview:
 * reemplazar un día completo sin ver qué se da de baja sería demasiado filoso.
 */
export function diffRoutineDay(current, next) {
  const before = (current?.ejercicios || []).map(e => e.nombre);
  const after = (next?.ejercicios || []).map(e => e.nombre);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  const currentByName = new Map((current?.ejercicios || []).map(e => [e.nombre, e]));
  const restChanged = (next?.ejercicios || [])
    .filter(e => {
      const prev = currentByName.get(e.nombre);
      return prev && e.descanso != null && prev.descanso !== e.descanso;
    })
    .map(e => ({ nombre: e.nombre, de: currentByName.get(e.nombre).descanso, a: e.descanso }));

  const kept = after.filter(n => beforeSet.has(n));
  const keptBefore = before.filter(n => afterSet.has(n));

  return {
    added: after.filter(n => !beforeSet.has(n)),
    removed: before.filter(n => !afterSet.has(n)),
    reordered: kept.join("|") !== keptBefore.join("|"),
    restChanged,
    focoChanged: next?.foco != null && next.foco !== current?.foco,
  };
}
