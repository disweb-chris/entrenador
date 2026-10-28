import { DAYS, DEFAULT_EXERCISES, REST_DEFAULTS, makeEmptySet } from "./constants.js";

// La rutina vivía hardcodeada en DEFAULT_EXERCISES: cambiar un ejercicio, el
// orden o un descanso de forma permanente exigía tocar código y desplegar. Acá
// pasa a ser un dato del usuario, y DEFAULT_EXERCISES queda sólo como semilla.
//
// Forma:
//   { lunes: { foco: "Piernas + Abs", ejercicios: [ {nombre, tipo, descanso, notas, carga?, alternativas?} ] } }
//
// `alternativas` son otras máquinas o variantes para el mismo lugar de la
// rutina ({nombre, tipo, descanso, notas, carga?}). Cada una es un ejercicio
// con nombre propio, así que su historial, récords y objetivos no se mezclan
// con los del principal. `carga` dice si el peso se anota "lado" o "total".
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
      // Firestore rechaza undefined: la carga sólo viaja si está definida.
      ...(ex.carga ? { load: ex.carga } : {}),
    };
  });
  return exercises;
}

/**
 * Las opciones de un lugar de la rutina: el principal primero y después sus
 * alternativas. Lo que una alternativa no define lo hereda del principal.
 */
export function variantsOf(entry) {
  if (!entry) return [];
  const { alternativas, ...main } = entry;
  return [
    main,
    ...(alternativas || []).map(a => ({
      tipo: main.tipo,
      descanso: main.descanso,
      notas: "",
      ...a,
    })),
  ];
}

/**
 * El ejercicio de la rutina al que pertenece un nombre, sea el principal o
 * una alternativa. `variantOf` (lo guarda la sesión al cambiar) manda sobre
 * el nombre: dos días pueden compartir alternativa.
 */
export function findRoutineEntry(dayRoutine, name, variantOf = null) {
  for (const entry of dayRoutine?.ejercicios || []) {
    const options = variantsOf(entry);
    if (variantOf ? entry.nombre === variantOf : options.some(v => v.nombre === name)) {
      return { entry, options, variant: options.find(v => v.nombre === name) ?? null };
    }
  }
  return null;
}

const hasDone = ex => (ex?.sets || []).some(s => s.done);

/**
 * Cambia un ejercicio de la sesión por otra de sus variantes, en el mismo
 * lugar. Si ya había series hechas con la variante actual se conservan (son
 * historial real: la máquina se ocupó a la mitad) y la nueva entra justo
 * después con las series que faltaban; si no, la reemplaza.
 *
 * `restTime` es el último descanso usado con la variante nueva, si se conoce.
 */
export function switchVariant(exercises, fromName, variant, { baseName, targets, restTime } = {}) {
  const current = exercises?.[fromName];
  if (!current || !variant?.nombre || variant.nombre === fromName) return exercises;
  // Ya está en la sesión (se volvió a una variante con series hechas): no se duplica.
  if (exercises[variant.nombre]) return exercises;

  const base = baseName ?? current.variantOf ?? fromName;
  const sets = current.sets || [];
  const done = sets.filter(s => s.done);
  const target = parseInt(targets?.[variant.nombre]?.series);
  const count = done.length
    ? Math.max(sets.length - done.length, 1)
    : Math.min(Math.max(target || sets.length || 1, 1), 10);

  const type = variant.tipo || current.type || "isolation";
  const next = {
    type,
    notes: variant.notas || "",
    restTime: restTime ?? variant.descanso ?? REST_DEFAULTS[type] ?? 60,
    sets: Array.from({ length: count }, makeEmptySet),
    ...(variant.carga ? { load: variant.carga } : {}),
    ...(variant.nombre !== base ? { variantOf: base } : {}),
  };

  if (current.order != null) {
    if (done.length) {
      // Entre la actual y la siguiente, para que quede pegada a la que reemplaza.
      const higher = Object.values(exercises).map(e => e?.order).filter(o => o > current.order);
      const after = higher.length ? Math.min(...higher) : current.order + 1;
      next.order = (current.order + after) / 2;
    } else {
      next.order = current.order;
    }
  }

  const out = { ...exercises, [variant.nombre]: next };
  if (done.length) out[fromName] = { ...current, sets: done };
  else delete out[fromName];
  return out;
}

/** Rutina de un día a partir de una sesión, para poder exportarla como JSON. */
export function routineDayFromSession(session, dayRoutine) {
  const known = new Map((dayRoutine?.ejercicios || []).map(e => [e.nombre, e]));
  const seen = new Set();
  return Object.entries(session?.exercises || {})
    .sort(([, a], [, b]) => (a?.order ?? 0) - (b?.order ?? 0))
    .map(([name, data]) => {
      // Una alternativa usada ese día ocupa el lugar de su principal: la rutina
      // sigue teniendo al principal, con sus alternativas.
      const nombre = data.variantOf && known.has(data.variantOf) ? data.variantOf : name;
      if (seen.has(nombre)) return null;
      seen.add(nombre);
      const k = known.get(nombre);
      const own = nombre === name;
      const out = {
        nombre,
        tipo: (own ? data.type : null) || k?.tipo || "isolation",
        descanso: (own ? data.restTime : null) ?? k?.descanso ?? REST_DEFAULTS[data.type] ?? 60,
        notas: k?.notas || "",
      };
      if (k?.carga) out.carga = k.carga;
      if (k?.alternativas?.length) out.alternativas = k.alternativas;
      return out;
    })
    .filter(Boolean);
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

  // Alternativas que cambian en ejercicios que ya estaban.
  const altNames = e => (e?.alternativas || []).map(a => a.nombre);
  const alternativesChanged = (next?.ejercicios || [])
    .filter(e => {
      const prev = currentByName.get(e.nombre);
      return prev && altNames(prev).join("|") !== altNames(e).join("|");
    })
    .map(e => ({ nombre: e.nombre, alternativas: altNames(e) }));

  return {
    added: after.filter(n => !beforeSet.has(n)),
    removed: before.filter(n => !afterSet.has(n)),
    reordered: kept.join("|") !== keptBefore.join("|"),
    restChanged,
    alternativesChanged,
    focoChanged: next?.foco != null && next.foco !== current?.foco,
  };
}
