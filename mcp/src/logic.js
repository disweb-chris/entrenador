// Lógica de lectura y escritura. Reutiliza src/lib tal cual para que el MCP vea
// y deje los datos exactamente como la app: mismo orden de ejercicios, mismas
// series pre-creadas, mismo criterio de récord y de progresión.
import {
  DAYS, REST_DEFAULTS, getDateKey, makeEmptySet, sortedExercises, getNextDayKey,
} from "../../src/lib/constants.js";
import { withDefaults, seedRoutine, sessionExercisesFromRoutine, variantsOf, findRoutineEntry, switchVariant } from "../../src/lib/routine.js";
import { computeBests, bestSet, recordStatus, roundKg, latestExerciseData } from "../../src/lib/records.js";
import { stagnationStatus, stagnationLabel } from "../../src/lib/stagnation.js";
import { suggestProgression } from "../../src/lib/progression.js";
import { getWeekKey } from "../../src/lib/report.js";
import { normalizeTarget, parseRoutineText } from "../../src/lib/routineParser.js";

export class UserError extends Error {}

// ── Fechas y días ────────────────────────────────────────────────────────────

export const today = () => getDateKey();

/** Semana ISO de una fecha YYYY-MM-DD. Al mediodía para que el huso no la corra de día. */
export function weekKeyOf(dateKey) {
  return getWeekKey(new Date(`${dateKey}T12:00:00`));
}

export function shiftWeek(dateKey, weeks) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return getWeekKey(d);
}

export function checkDate(fecha) {
  if (fecha == null || fecha === "") return today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(new Date(`${fecha}T12:00:00`))) {
    throw new UserError(`Fecha inválida "${fecha}": usá YYYY-MM-DD`);
  }
  return fecha;
}

/** Lunes (YYYY-MM-DD) de una semana ISO "2026-W43". */
export function mondayOfWeek(weekKey) {
  const [y, w] = weekKey.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4, 12));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export function checkWeek(semana) {
  if (semana == null || semana === "") return weekKeyOf(today());
  if (!/^\d{4}-W\d{2}$/.test(semana)) throw new UserError(`Semana inválida "${semana}": usá el formato 2026-W43`);
  return semana;
}

export const compact = s => norm(s).replace(/[^a-z0-9]/g, "");

export const norm = s => String(s ?? "")
  .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ").trim();

const DAY_ALIASES = new Map();
for (const d of DAYS) {
  DAY_ALIASES.set(norm(d.key), d.key);
  DAY_ALIASES.set(norm(d.full), d.key);
  DAY_ALIASES.set(norm(d.label), d.key);
}

/** "Miércoles", "mie", "MIÉ", "mierc" → "mierc". */
export function resolveDay(raw) {
  if (raw == null || raw === "") return null;
  const key = DAY_ALIASES.get(norm(raw)) ?? DAY_ALIASES.get(norm(raw).slice(0, 3));
  if (!key) throw new UserError(`Día desconocido "${raw}". Días válidos: ${DAYS.map(d => d.key).join(", ")}`);
  return key;
}

export const dayInfo = dayKey => DAYS.find(d => d.key === dayKey) || null;

// ── Nombres de ejercicio ─────────────────────────────────────────────────────

/**
 * Busca un ejercicio por nombre: exacto, después sin mayúsculas ni tildes,
 * después por coincidencia parcial única. Los nombres cambian entre sesiones
 * ("Facepull" / "Face Pull"), así que escribir con el nombre equivocado
 * duplicaría el ejercicio.
 */
export function matchName(names, query) {
  const list = [...new Set(names)];
  if (list.includes(query)) return query;
  const q = norm(query);
  const exact = list.filter(n => norm(n) === q);
  if (exact.length) return exact[0];
  const sameLetters = list.filter(n => compact(n) === compact(query));
  if (sameLetters.length === 1) return sameLetters[0];
  const partial = list.filter(n => norm(n).includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new UserError(`"${query}" coincide con varios ejercicios: ${partial.join(", ")}. Usá el nombre exacto.`);
  }
  return null;
}

// ── Formato de salida ────────────────────────────────────────────────────────

export const toNum = v => {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

function formatSet(s, i) {
  const out = {
    serie: i + 1,
    peso: toNum(s.weight),
    reps: toNum(s.reps),
    rir: s.rir ?? null,
    fatiga: s.fatigue ?? null,
    hecha: !!s.done,
  };
  if (s.notes) out.notas = s.notes;
  if (typeof s.doneAt === "number") out.registrada = new Date(s.doneAt).toISOString();
  return out;
}

function exerciseStats(sets) {
  const done = (sets || []).filter(s => s.done);
  const volumen = done.reduce((a, s) => a + (toNum(s.weight) || 0) * (toNum(s.reps) || 0), 0);
  const best = bestSet(sets);
  return {
    series_hechas: done.length,
    series_totales: (sets || []).length,
    volumen,
    mejor_serie: best ? { peso: best.weight, reps: best.reps, e1rm: roundKg(best.e1rm) } : null,
  };
}

export function formatExercise(name, data, { soloHechas = false } = {}) {
  const sets = (data?.sets || []).map(formatSet);
  return {
    nombre: name,
    ...(data?.load ? { carga: data.load } : {}),
    ...(data?.variantOf ? { alternativa_de: data.variantOf } : {}),
    tipo: data?.type || "isolation",
    orden: data?.order ?? null,
    descanso: data?.restTime ?? null,
    notas: data?.notes || "",
    ...exerciseStats(data?.sets),
    series: soloHechas ? sets.filter(s => s.hecha) : sets,
  };
}

export function formatSession(session, opts = {}) {
  const info = dayInfo(session.dayKey);
  const ejercicios = sortedExercises(session.exercises, session.dayKey)
    .map(([name, data]) => formatExercise(name, data, opts));
  return {
    fecha: session.dateKey,
    dia: session.dayKey,
    dia_nombre: info?.full ?? session.dayKey,
    notas: session.sessionNotes || "",
    series_hechas: ejercicios.reduce((a, e) => a + e.series_hechas, 0),
    series_totales: ejercicios.reduce((a, e) => a + e.series_totales, 0),
    volumen: ejercicios.reduce((a, e) => a + e.volumen, 0),
    ejercicios,
  };
}

// ── Rutina ───────────────────────────────────────────────────────────────────

/** La rutina como la usa la app: la guardada, o la sembrada desde sus sesiones. */
export async function loadRoutine(store, recent = null) {
  const stored = await store.getRoutine();
  if (stored) return { days: withDefaults(stored), origen: "guardada" };
  const sessions = recent ?? await store.getRecentSessions(60);
  return { days: seedRoutine(sessions), origen: "sembrada desde las últimas sesiones (todavía no hay rutina guardada)" };
}

/** Objetivos vigentes para una fecha: los de su semana o, si no hay, los de la anterior (como la app). */
export async function targetsFor(store, dateKey) {
  const week = weekKeyOf(dateKey);
  const own = await store.getTargets(week);
  if (own) return { semana: week, targets: own, heredados: false };
  const prevWeek = shiftWeek(dateKey, -1);
  const prev = await store.getTargets(prevWeek);
  return { semana: prevWeek, targets: prev || {}, heredados: !!prev };
}

// ── Qué sesión tocar ─────────────────────────────────────────────────────────

/**
 * Resuelve fecha y día de rutina de una escritura. El id de la sesión es
 * uid_fecha_día, así que sin el día no se sabe qué documento tocar:
 *  - si se indica `dia`, ese;
 *  - si ya hay una sola sesión ese día, esa;
 *  - si es hoy y no hay ninguna, la que toca según la rotación (getNextDayKey).
 */
export async function resolveTarget(store, { fecha, dia } = {}) {
  const dateKey = checkDate(fecha);
  const explicit = resolveDay(dia);
  if (explicit) return { dateKey, dayKey: explicit };

  const sessions = await store.getSessionsByDate(dateKey);
  if (sessions.length === 1) return { dateKey, dayKey: sessions[0].dayKey };
  if (sessions.length > 1) {
    throw new UserError(`El ${dateKey} hay varias sesiones (${sessions.map(s => s.dayKey).join(", ")}). Indicá "dia".`);
  }
  if (dateKey === today()) {
    const profile = await store.getProfile();
    return { dateKey, dayKey: getNextDayKey(profile, dateKey) };
  }
  throw new UserError(`No hay sesión el ${dateKey}. Indicá "dia" (${DAYS.map(d => d.key).join(", ")}) para crearla.`);
}

/** Sesión nueva armada desde la rutina, igual que loadDay en SessionView. */
async function freshSession(store, dateKey, dayKey) {
  const [{ days }, last, { targets }] = await Promise.all([
    loadRoutine(store),
    store.getLastSession(dayKey, dateKey),
    targetsFor(store, dateKey),
  ]);
  return {
    exercises: sessionExercisesFromRoutine(days[dayKey], { lastSession: last, targets }),
    sessionNotes: "",
    _routineDay: days[dayKey],
    _lastSession: last,
  };
}

/**
 * Modifica una sesión (creándola desde la rutina si hace falta) dentro de una
 * transacción. `mutate(session, ctx)` cambia `session` en el lugar.
 */
export async function withSession(store, where, mutate, { create = true } = {}) {
  const { dateKey, dayKey } = await resolveTarget(store, where);
  // Lo necesario para crearla se lee antes: las lecturas de la transacción
  // tienen que ir antes que sus escrituras y no admiten consultas sueltas.
  const existing = await store.getSession(dateKey, dayKey);
  const fresh = existing ? null : await freshSession(store, dateKey, dayKey);
  if (!existing && !create) throw new UserError(`No hay sesión de ${dayKey} el ${dateKey}`);

  let result;
  const saved = await store.updateSession(dateKey, dayKey, async current => {
    let session;
    if (current) {
      session = structuredClone(current);
    } else {
      const { _routineDay, _lastSession, ...base } = fresh;
      session = structuredClone(base);
    }
    session.exercises ||= {};
    const ctx = { dateKey, dayKey, routineDay: fresh?._routineDay, lastSession: fresh?._lastSession, created: !current };
    result = await mutate(session, ctx);
    return session;
  });

  // La rotación avanza al registrar series hoy, como en la app.
  if (dateKey === today() && hasDoneSets(saved)) {
    await store.setProfile({ lastWorkedDay: dayKey, lastWorkedDate: dateKey });
  }
  return { session: saved, dateKey, dayKey, created: !existing, result };
}

function hasDoneSets(session) {
  return Object.values(session?.exercises || {}).some(ex => (ex.sets || []).some(s => s.done));
}

const isBlank = s => !s.done && (s.weight === "" || s.weight == null) && (s.reps === "" || s.reps == null);

/** Todos los nombres de la rutina de un día, principales y alternativas. */
export function routineVariantNames(dayRoutine) {
  return (dayRoutine?.ejercicios || []).flatMap(e => variantsOf(e).map(v => v.nombre));
}

/**
 * Nombre del ejercicio en la sesión; si no existe, lo agrega. Si es una
 * alternativa (o el principal) de un lugar de la rutina que ya ocupa otra
 * variante, la cambia en ese lugar como el botón de la app; si no, va al final.
 */
export async function ensureExercise(store, session, ctx, query, { tipo, restTime } = {}) {
  const existing = matchName(Object.keys(session.exercises), query);
  if (existing) return { name: existing, added: false };

  // Si está en la rutina con otro nombre, usar el de la rutina mantiene el historial unido.
  let routineDay = ctx.routineDay;
  if (!routineDay) routineDay = (await loadRoutine(store)).days[ctx.dayKey];
  const name = matchName(routineVariantNames(routineDay), query) ?? String(query).trim();
  const slot = findRoutineEntry(routineDay, name);
  const fromRoutine = slot?.variant ?? null;

  const last = ctx.lastSession ?? await store.getLastSession(ctx.dayKey, ctx.dateKey);
  const lastRest = last?.exercises?.[name]?.restTime;

  if (slot) {
    // Quién ocupa hoy ese lugar; con varias (una con series hechas y otra
    // después), la última.
    const occupant = sortedExercises(session.exercises, ctx.dayKey)
      .filter(([n, d]) => findRoutineEntry(routineDay, n, d?.variantOf)?.entry.nombre === slot.entry.nombre)
      .pop()?.[0];
    if (occupant) {
      const { targets } = await targetsFor(store, ctx.dateKey);
      const variant = { ...fromRoutine, ...(tipo ? { tipo } : {}) };
      session.exercises = switchVariant(session.exercises, occupant, variant, {
        baseName: slot.entry.nombre, targets, restTime: restTime ?? lastRest,
      });
      // Con series hechas la anterior se queda al lado; si no, se reemplaza.
      return { name, added: true, [session.exercises[occupant] ? "alongside" : "replaced"]: occupant };
    }
  }

  const type = tipo || fromRoutine?.tipo || last?.exercises?.[name]?.type || "isolation";
  const orders = Object.values(session.exercises).map(e => e?.order ?? -1);
  session.exercises[name] = {
    type,
    sets: [],
    notes: fromRoutine?.notas || "",
    // Al final de la sesión, que es donde se está agregando.
    order: orders.length ? Math.max(...orders) + 1 : 0,
    restTime: restTime ?? lastRest ?? fromRoutine?.descanso ?? REST_DEFAULTS[type] ?? null,
    ...(fromRoutine?.carga ? { load: fromRoutine.carga } : {}),
    ...(slot && name !== slot.entry.nombre ? { variantOf: slot.entry.nombre } : {}),
  };
  return { name, added: true };
}

export function weightToStore(peso) {
  if (peso === null || peso === undefined || peso === "") return "";
  const n = toNum(peso);
  if (n === null) throw new UserError(`Peso inválido "${peso}"`);
  return String(n);
}

export function repsToStore(reps) {
  if (reps === null || reps === undefined || reps === "") return "";
  const n = parseInt(String(reps), 10);
  if (isNaN(n) || n < 0) throw new UserError(`Reps inválidas "${reps}"`);
  return String(n);
}

/** Completa la primera serie vacía pre-creada; si no queda ninguna, agrega una. */
export function addDoneSet(exercise, { peso, reps, rir, fatiga, notas }) {
  const set = {
    ...makeEmptySet(),
    weight: weightToStore(peso),
    reps: repsToStore(reps),
    rir: rir ?? null,
    fatigue: fatiga ?? null,
    notes: notas ?? "",
    done: true,
    doneAt: Date.now(),
  };
  exercise.sets ||= [];
  const idx = exercise.sets.findIndex(isBlank);
  if (idx === -1) {
    exercise.sets.push(set);
    return exercise.sets.length - 1;
  }
  exercise.sets[idx] = set;
  return idx;
}

export function setAt(exercise, serie) {
  const i = Number(serie) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= (exercise.sets || []).length) {
    throw new UserError(`No existe la serie ${serie}: el ejercicio tiene ${(exercise.sets || []).length}`);
  }
  return i;
}

// ── Análisis ─────────────────────────────────────────────────────────────────

/** Todos los nombres de ejercicio que aparecen en el historial. */
export function allExerciseNames(sessions) {
  const names = new Set();
  for (const s of sessions || []) Object.keys(s.exercises || {}).forEach(n => names.add(n));
  return [...names];
}

export function recordFor(sessions, name, excludeDateKey, currentSets) {
  const bests = computeBests(sessions, excludeDateKey);
  const status = recordStatus(currentSets, bests[name]);
  const fmt = m => m ? { peso: m.weight, reps: m.reps, e1rm: roundKg(m.e1rm), ...(m.dateKey ? { fecha: m.dateKey } : {}) } : null;
  return { es_record: status.isRecord, mejor_hoy: fmt(status.current), record_anterior: fmt(status.previous) };
}

export function stagnationFor(name, sessions) {
  const st = stagnationStatus(name, sessions);
  return st ? { sesiones_sin_superar: st.since, rir_promedio: st.avgRir, fecha_record: st.bestDate, accion: st.action, texto: stagnationLabel(st) } : null;
}

export { variantsOf, findRoutineEntry, latestExerciseData, computeBests, roundKg, suggestProgression, normalizeTarget, parseRoutineText, sortedExercises, getNextDayKey, makeEmptySet };
