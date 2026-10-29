import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DAYS } from "../../src/lib/constants.js";
import {
  UserError, today, checkDate, checkWeek, mondayOfWeek, compact, shiftWeek, weekKeyOf, resolveDay, dayInfo, norm, matchName,
  formatSession, formatExercise, loadRoutine, targetsFor, withSession, ensureExercise, addDoneSet, setAt,
  weightToStore, repsToStore, allExerciseNames, recordFor, stagnationFor, toNum,
  computeBests, roundKg, suggestProgression, normalizeTarget, parseRoutineText, sortedExercises,
  getNextDayKey, makeEmptySet, variantsOf, findRoutineEntry, latestExerciseData, routineVariantNames,
} from "./logic.js";

// ── Esquemas compartidos ─────────────────────────────────────────────────────

const DAY_LIST = DAYS.map(d => `${d.key} (${d.full}: ${d.focus})`).join(", ");
const fecha = z.string().optional().describe("YYYY-MM-DD. Default: hoy (hora de Argentina)");
const dia = z.string().optional().describe(
  `Día de la rutina: ${DAY_LIST}. Si se omite: el de la sesión que ya exista esa fecha, o el que toca hoy según la rotación`
);
const ejercicio = z.string().min(1).describe("Nombre del ejercicio. Acepta mayúsculas/tildes distintas o parte del nombre si es único");
const peso = z.union([z.number(), z.string()]).describe("Peso en kg, ej: 65 o '62.5'");
const reps = z.union([z.number().int(), z.string()]);
const rir = z.number().int().min(0).max(4).describe("Reps en reserva: 0=fallo, 1=objetivo, 2=OK, 3=liviano, 4=muy fácil (4+)");
const fatiga = z.number().int().min(1).max(5).describe("Fatiga: 1=fresco, 2=leve, 3=moderada, 4=alta, 5=al límite");
const tipo = z.enum(["compound", "isolation"]);
const serie = z.number().int().min(1).describe("Número de serie, empezando en 1");
const carga = z.enum(["lado", "total"]).describe("Cómo se anota el peso: 'lado' = el de un lado (mancuernas, palancas independientes), 'total' = la suma de los dos. La app lo muestra junto al nombre");

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

const json = data => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

function tool(server, name, config, handler) {
  server.registerTool(name, config, async args => {
    try {
      return json(await handler(args ?? {}));
    } catch (err) {
      if (err instanceof UserError) return { isError: true, content: [{ type: "text", text: err.message }] };
      // Firestore manda el link para crear un índice faltante dentro del mensaje.
      console.error(`[${name}]`, err);
      return { isError: true, content: [{ type: "text", text: `Error interno: ${err.message}` }] };
    }
  });
}

/** Resultado de una escritura: el ejercicio tal como quedó guardado. */
function written(out, name, extra = {}) {
  const info = dayInfo(out.dayKey);
  return {
    ok: true,
    fecha: out.dateKey,
    dia: out.dayKey,
    dia_nombre: info?.full ?? out.dayKey,
    ...extra,
    ejercicio: name && out.session.exercises[name] ? formatExercise(name, out.session.exercises[name]) : undefined,
  };
}

export function buildServer(store) {
  const server = new McpServer(
    { name: "entrenador", version: "1.0.0" },
    {
      instructions: [
        "Datos de OVERLOAD, la app de entrenamiento con sobrecarga progresiva del usuario.",
        `La semana tiene 5 sesiones que rotan en orden: ${DAY_LIST}. Faltar un día no corre la rutina: la próxima sesión es la siguiente a la última entrenada (ver proxima_sesion).`,
        "Cada sesión es una fecha + un día de rutina. Los pesos son kg. RIR 0-4 (0=fallo, 1=objetivo). Fatiga 1-5.",
        "Para registrar lo que el usuario está haciendo en el gimnasio usá registrar_set: completa la siguiente serie pendiente del ejercicio, como tocar el check en la app.",
        "Los nombres de ejercicio no son siempre iguales entre sesiones (ej. 'Facepull' y 'Face Pull'): usá rutina o sesion_por_fecha para ver los nombres vigentes antes de escribir.",
        "Cada ejercicio de la rutina puede tener alternativas (otra máquina o variante para el mismo lugar). Cada alternativa es un ejercicio con nombre propio: su historial, récords y objetivos son suyos y no se mezclan con los del principal. 'carga' dice si el peso es por lado o total. Registrar una serie con el nombre de una alternativa la cambia en ese lugar de la sesión, como el botón de la app.",
      ].join("\n"),
    }
  );

  // ── Lectura ────────────────────────────────────────────────────────────────

  tool(server, "sesion_por_fecha", {
    title: "Sesión por fecha",
    description: "Devuelve las sesiones de una fecha con todos sus ejercicios en el orden de la rutina, series (hechas y pendientes), volumen y mejor serie. Default: hoy.",
    inputSchema: { fecha, dia: z.string().optional().describe("Filtra por día de rutina si esa fecha hay más de una sesión") },
    annotations: READ,
  }, async ({ fecha: f, dia: d }) => {
    const dateKey = checkDate(f);
    const dayKey = resolveDay(d);
    let sessions = await store.getSessionsByDate(dateKey);
    if (dayKey) sessions = sessions.filter(s => s.dayKey === dayKey);
    if (!sessions.length) {
      return { fecha: dateKey, sesiones: [], mensaje: `No hay sesión registrada el ${dateKey}${dayKey ? ` (${dayKey})` : ""}` };
    }
    return { fecha: dateKey, sesiones: sessions.map(s => formatSession(s)) };
  });

  tool(server, "resumen_ultimas_sesiones", {
    title: "Resumen de últimas sesiones",
    description: "Resumen de las últimas N sesiones: fecha, día, ejercicios entrenados (en orden) con series hechas, peso máximo y volumen, ejercicios salteados y notas.",
    inputSchema: { cantidad: z.number().int().min(1).max(60).default(7) },
    annotations: READ,
  }, async ({ cantidad = 7 }) => {
    const sessions = await store.getRecentSessions(cantidad);
    return sessions.map(s => {
      const f = formatSession(s);
      const hechos = f.ejercicios.filter(e => e.series_hechas > 0);
      return {
        fecha: f.fecha,
        dia: f.dia,
        dia_nombre: f.dia_nombre,
        notas: f.notas,
        series_hechas: f.series_hechas,
        volumen: f.volumen,
        ejercicios: hechos.map(e => ({
          nombre: e.nombre,
          series: e.series_hechas,
          peso_max: Math.max(...e.series.filter(x => x.hecha).map(x => x.peso || 0)),
          reps: e.series.filter(x => x.hecha).map(x => x.reps),
          volumen: e.volumen,
        })),
        sin_hacer: f.ejercicios.filter(e => e.series_hechas === 0).map(e => e.nombre),
      };
    });
  });

  tool(server, "historial_ejercicio", {
    title: "Historial de un ejercicio",
    description: "Progresión de un ejercicio en las últimas sesiones (sólo series completadas): peso, reps, RIR, fatiga, mejor serie y 1RM estimado por sesión, más récord y estancamiento. Coincidencia parcial e insensible a mayúsculas y tildes.",
    inputSchema: {
      ejercicio: z.string().min(1).describe("Nombre o parte del nombre"),
      limite_resultados: z.number().int().min(1).max(100).default(10),
      sesiones_a_revisar: z.number().int().min(1).max(200).default(30).describe("Cuántas sesiones recientes escanear"),
    },
    annotations: READ,
  }, async ({ ejercicio: q, limite_resultados = 10, sesiones_a_revisar = 30 }) => {
    const sessions = await store.getRecentSessions(sesiones_a_revisar);
    const cq = compact(q);
    const names = allExerciseNames(sessions).filter(n => compact(n).includes(cq));
    if (!names.length) return { ejercicio: q, mensaje: "No aparece en las sesiones revisadas", sesiones: [] };

    const rows = [];
    for (const s of sessions) {
      for (const name of names) {
        const data = s.exercises?.[name];
        const done = (data?.sets || []).filter(x => x.done && x.weight !== "" && x.weight != null);
        if (!done.length) continue;
        const f = formatExercise(name, data, { soloHechas: true });
        rows.push({
          fecha: s.dateKey,
          dia: s.dayKey,
          ejercicio: name,
          peso_max: Math.max(...f.series.map(x => x.peso || 0)),
          volumen: f.volumen,
          mejor_serie: f.mejor_serie,
          series: f.series,
        });
      }
    }
    return {
      ejercicio: q,
      nombres_encontrados: names,
      // Por nombre exacto: las variantes son ejercicios distintos para la app.
      records: Object.fromEntries(names.map(n => {
        const b = computeBests(sessions)[n];
        return [n, b ? { peso: b.weight, reps: b.reps, e1rm: roundKg(b.e1rm), fecha: b.dateKey } : null];
      })),
      estancamiento: Object.fromEntries(names.map(n => [n, stagnationFor(n, sessions)])),
      sesiones: rows.slice(0, limite_resultados),
    };
  });

  tool(server, "objetivos_semana", {
    title: "Objetivos de la semana",
    description: "Objetivos (series, reps, peso) por ejercicio para una semana ISO. Si la semana no tiene objetivos propios devuelve los de la anterior, que es lo que muestra la app.",
    inputSchema: { semana: z.string().optional().describe("Formato ISO, ej: '2026-W43'. Default: semana actual") },
    annotations: READ,
  }, async ({ semana }) => {
    const week = checkWeek(semana);
    const own = await store.getTargets(week);
    if (own) return { semana: week, heredados: false, objetivos: own };
    const prevWeek = shiftWeek(mondayOfWeek(week), -1);
    const prev = await store.getTargets(prevWeek);
    return prev
      ? { semana: week, heredados: true, semana_origen: prevWeek, objetivos: prev }
      : { semana: week, heredados: false, objetivos: {}, mensaje: "Sin objetivos para esta semana ni la anterior" };
  });

  tool(server, "rutina", {
    title: "Rutina",
    description: "La rutina del usuario por día: foco y ejercicios en orden con tipo, descanso (s), notas, carga ('lado' o 'total', si está definida) y alternativas (otras máquinas o variantes para ese lugar, cada una con nombre, tipo, descanso, notas y carga propios). Es la plantilla con la que la app arma cada sesión nueva: entra el principal y en la sesión se cambia a una alternativa con un toque.",
    inputSchema: { dia: z.string().optional().describe("Un solo día; default: todos") },
    annotations: READ,
  }, async ({ dia: d }) => {
    const { days, origen } = await loadRoutine(store);
    const dayKey = resolveDay(d);
    const pick = dayKey ? { [dayKey]: days[dayKey] } : days;
    return {
      origen,
      dias: Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, { nombre: dayInfo(k)?.full, ...v }])),
    };
  });

  tool(server, "tiempos_descanso", {
    title: "Tiempos de descanso",
    description: "Descanso por ejercicio en segundos: el de la rutina y el último usado en una sesión (la app arranca cada sesión con el último usado).",
    inputSchema: {},
    annotations: READ,
  }, async () => {
    const recent = await store.getRecentSessions(60);
    const { days } = await loadRoutine(store, recent);
    const out = {};
    for (const [dayKey, day] of Object.entries(days)) {
      for (const ex of (day.ejercicios || []).flatMap(variantsOf)) {
        out[ex.nombre] ||= { dias: [], rutina: ex.descanso ?? null, ultimo_usado: null };
        out[ex.nombre].dias.push(dayKey);
      }
    }
    // recent viene de la más nueva a la más vieja: el primero que aparece es el último usado.
    for (const s of recent) {
      for (const [name, data] of Object.entries(s.exercises || {})) {
        if (data?.restTime == null) continue;
        out[name] ||= { dias: [], rutina: null, ultimo_usado: null };
        if (out[name].ultimo_usado == null) out[name].ultimo_usado = data.restTime;
      }
    }
    return out;
  });

  tool(server, "records_personales", {
    title: "Récords personales",
    description: "Mejor serie histórica por ejercicio, medida por 1RM estimado (Epley), con fecha.",
    inputSchema: {
      ejercicio: z.string().optional().describe("Filtra por nombre o parte del nombre"),
      sesiones_a_revisar: z.number().int().min(1).max(500).default(200),
    },
    annotations: READ,
  }, async ({ ejercicio: q, sesiones_a_revisar = 200 }) => {
    const sessions = await store.getRecentSessions(sesiones_a_revisar);
    const bests = computeBests(sessions);
    return Object.fromEntries(
      Object.entries(bests)
        .filter(([n]) => !q || norm(n).includes(norm(q)))
        .sort(([a], [b]) => a.localeCompare(b, "es"))
        .map(([n, b]) => [n, { peso: b.weight, reps: b.reps, e1rm: roundKg(b.e1rm), fecha: b.dateKey }])
    );
  });

  tool(server, "proxima_sesion", {
    title: "Próxima sesión",
    description: "Qué sesión toca (según la rotación) y, por ejercicio: lo hecho la última vez, el objetivo de la semana, la sugerencia de progresión de la app (subir peso / sumar rep / sostener) y si está estancado.",
    inputSchema: { dia: z.string().optional().describe("Forzar un día en vez del que toca por rotación"), fecha },
    annotations: READ,
  }, async ({ dia: d, fecha: f }) => {
    const dateKey = checkDate(f);
    const profile = await store.getProfile();
    const dayKey = resolveDay(d) ?? getNextDayKey(profile, dateKey);
    const recent = await store.getRecentSessions(60);
    const [{ days }, last, tg, current] = await Promise.all([
      loadRoutine(store, recent),
      store.getLastSession(dayKey, dateKey),
      targetsFor(store, dateKey),
      store.getSession(dateKey, dayKey),
    ]);
    const routineDay = days[dayKey];
    return {
      fecha: dateKey,
      dia: dayKey,
      dia_nombre: dayInfo(dayKey)?.full,
      foco: routineDay?.foco,
      ultima_entrenada: profile?.lastWorkedDay ? { dia: profile.lastWorkedDay, fecha: profile.lastWorkedDate } : null,
      sesion_anterior: last?.dateKey ?? null,
      ya_empezada: !!current,
      objetivos_semana: tg.semana + (tg.heredados ? " (heredados de la semana anterior)" : ""),
      ejercicios: (routineDay?.ejercicios || []).map(entry => {
        const [main, ...alts] = variantsOf(entry);
        // El principal se compara con la sesión anterior de ese día, como la
        // app; una alternativa, con la última vez que se usó.
        const detail = (ex, prev) => {
          const prevDone = (prev?.sets || []).filter(s => s.done).map(s => ({ peso: toNum(s.weight), reps: toNum(s.reps), rir: s.rir ?? null }));
          const sug = suggestProgression(prev, ex.tipo);
          return {
            nombre: ex.nombre,
            ...(ex.carga ? { carga: ex.carga } : {}),
            tipo: ex.tipo,
            descanso: prev?.restTime ?? ex.descanso,
            notas: ex.notas || undefined,
            ultima_vez: prevDone.length ? prevDone : null,
            objetivo: tg.targets?.[ex.nombre] ?? null,
            sugerencia: sug ? { peso: sug.weight, reps: sug.reps, accion: sug.action, motivo: sug.reason } : null,
            estancamiento: stagnationFor(ex.nombre, recent),
          };
        };
        const lastOf = name => last?.exercises?.[name] ?? latestExerciseData(recent, name, dateKey);
        // Qué variante quedó en la sesión de hoy si ya se empezó y se cambió.
        const inUse = current && Object.entries(current.exercises || {})
          .filter(([n, d]) => findRoutineEntry(routineDay, n, d?.variantOf)?.entry.nombre === entry.nombre)
          .map(([n]) => n);
        return {
          ...detail(main, lastOf(main.nombre)),
          ...(inUse?.length && !(inUse.length === 1 && inUse[0] === main.nombre) ? { en_sesion: inUse } : {}),
          ...(alts.length ? { alternativas: alts.map(a => detail(a, lastOf(a.nombre))) } : {}),
        };
      }),
    };
  });

  // ── Escritura: sesiones ────────────────────────────────────────────────────

  tool(server, "registrar_set", {
    title: "Registrar serie",
    description: "Registra una serie hecha (como tocar el check en la app): completa la primera serie pendiente del ejercicio o agrega una nueva. Si la sesión no existe la crea desde la rutina del día. Si el ejercicio no está en la sesión: si es una alternativa (o el principal) de un lugar de la rutina, la cambia en ese lugar; si no, lo agrega al final. Avanza la rotación si es hoy. Devuelve cómo quedó el ejercicio y si es récord.",
    inputSchema: {
      ejercicio, peso, reps,
      rir: rir.optional(),
      fatiga: fatiga.optional(),
      notas: z.string().optional().describe("Nota de la serie"),
      fecha, dia,
      tipo: tipo.optional().describe("Sólo si el ejercicio es nuevo. Default: el de la rutina o isolation"),
      restTime: z.number().int().min(5).max(900).optional().describe("Descanso del ejercicio en segundos (queda guardado para la próxima)"),
    },
    annotations: WRITE,
  }, async args => {
    let name, added, replaced, alongside, idx;
    const out = await withSession(store, args, async (session, ctx) => {
      ({ name, added, replaced, alongside } = await ensureExercise(store, session, ctx, args.ejercicio, { tipo: args.tipo, restTime: args.restTime }));
      const ex = session.exercises[name];
      if (args.restTime != null) ex.restTime = args.restTime;
      idx = addDoneSet(ex, { peso: args.peso, reps: args.reps, rir: args.rir, fatiga: args.fatiga, notas: args.notas });
    });
    const recent = await store.getRecentSessions(200);
    return written(out, name, {
      serie_registrada: idx + 1,
      sesion_creada: out.created || undefined,
      ejercicio_agregado: added || undefined,
      // Cambio de alternativa: a cuál reemplazó, o al lado de cuál quedó (si ya tenía series hechas).
      reemplaza_a: replaced,
      junto_a: alongside,
      record: recordFor(recent, name, out.dateKey, out.session.exercises[name].sets),
    });
  });

  tool(server, "editar_set", {
    title: "Editar serie",
    description: "Corrige una serie existente (peso, reps, RIR, fatiga, notas o si está hecha). Sólo cambia los campos que se pasan.",
    inputSchema: {
      ejercicio, serie,
      peso: peso.optional(), reps: reps.optional(),
      rir: rir.nullable().optional(), fatiga: fatiga.nullable().optional(),
      notas: z.string().optional(),
      hecha: z.boolean().optional(),
      fecha, dia,
    },
    annotations: WRITE,
  }, async args => {
    let name;
    const out = await withSession(store, args, async session => {
      name = matchName(Object.keys(session.exercises), args.ejercicio);
      if (!name) throw new UserError(`"${args.ejercicio}" no está en esa sesión`);
      const ex = session.exercises[name];
      const i = setAt(ex, args.serie);
      const s = { ...ex.sets[i] };
      if (args.peso !== undefined) s.weight = weightToStore(args.peso);
      if (args.reps !== undefined) s.reps = repsToStore(args.reps);
      if (args.rir !== undefined) s.rir = args.rir;
      if (args.fatiga !== undefined) s.fatigue = args.fatiga;
      if (args.notas !== undefined) s.notes = args.notas;
      if (args.hecha !== undefined && args.hecha !== !!s.done) {
        s.done = args.hecha;
        s.doneAt = args.hecha ? Date.now() : null;
      }
      ex.sets[i] = s;
    }, { create: false });
    return written(out, name);
  });

  tool(server, "eliminar_set", {
    title: "Eliminar serie",
    description: "Borra una serie de un ejercicio de una sesión.",
    inputSchema: { ejercicio, serie, fecha, dia },
    annotations: DESTRUCTIVE,
  }, async args => {
    let name;
    const out = await withSession(store, args, async session => {
      name = matchName(Object.keys(session.exercises), args.ejercicio);
      if (!name) throw new UserError(`"${args.ejercicio}" no está en esa sesión`);
      const ex = session.exercises[name];
      ex.sets.splice(setAt(ex, args.serie), 1);
    }, { create: false });
    return written(out, name);
  });

  tool(server, "agregar_ejercicio", {
    title: "Agregar ejercicio a la sesión",
    description: "Agrega un ejercicio al final de la sesión con N series vacías (sin marcarlas como hechas). Sólo afecta a esa sesión; para que quede en la rutina usá guardar_rutina_dia.",
    inputSchema: {
      ejercicio,
      tipo: tipo.optional(),
      series: z.number().int().min(1).max(10).default(1),
      restTime: z.number().int().min(5).max(900).optional(),
      notas: z.string().optional(),
      fecha, dia,
    },
    annotations: WRITE,
  }, async args => {
    let name, added;
    const out = await withSession(store, args, async (session, ctx) => {
      ({ name, added } = await ensureExercise(store, session, ctx, args.ejercicio, { tipo: args.tipo, restTime: args.restTime }));
      if (!added) throw new UserError(`"${name}" ya está en esa sesión`);
      const ex = session.exercises[name];
      ex.sets = Array.from({ length: args.series ?? 1 }, makeEmptySet);
      if (args.notas !== undefined) ex.notes = args.notas;
    });
    return written(out, name);
  });

  tool(server, "eliminar_ejercicio", {
    title: "Quitar ejercicio de la sesión",
    description: "Quita un ejercicio (con todas sus series) de una sesión. No toca la rutina.",
    inputSchema: { ejercicio, fecha, dia },
    annotations: DESTRUCTIVE,
  }, async args => {
    let name;
    const out = await withSession(store, args, async session => {
      name = matchName(Object.keys(session.exercises), args.ejercicio);
      if (!name) throw new UserError(`"${args.ejercicio}" no está en esa sesión`);
      delete session.exercises[name];
    }, { create: false });
    return { ok: true, fecha: out.dateKey, dia: out.dayKey, eliminado: name, quedan: sortedExercises(out.session.exercises, out.dayKey).map(([n]) => n) };
  });

  tool(server, "editar_ejercicio_sesion", {
    title: "Editar ejercicio de la sesión",
    description: "Cambia notas, descanso o tipo de un ejercicio dentro de una sesión.",
    inputSchema: {
      ejercicio,
      notas: z.string().optional(),
      restTime: z.number().int().min(5).max(900).optional(),
      tipo: tipo.optional(),
      fecha, dia,
    },
    annotations: WRITE,
  }, async args => {
    let name;
    const out = await withSession(store, args, async session => {
      name = matchName(Object.keys(session.exercises), args.ejercicio);
      if (!name) throw new UserError(`"${args.ejercicio}" no está en esa sesión`);
      const ex = session.exercises[name];
      if (args.notas !== undefined) ex.notes = args.notas;
      if (args.restTime !== undefined) ex.restTime = args.restTime;
      if (args.tipo !== undefined) ex.type = args.tipo;
    }, { create: false });
    return written(out, name);
  });

  tool(server, "notas_sesion", {
    title: "Notas de la sesión",
    description: "Guarda las notas generales de una sesión (reemplaza las existentes).",
    inputSchema: { notas: z.string(), fecha, dia },
    annotations: WRITE,
  }, async args => {
    const out = await withSession(store, args, async session => { session.sessionNotes = args.notas; }, { create: false });
    return { ok: true, fecha: out.dateKey, dia: out.dayKey, notas: out.session.sessionNotes };
  });

  // ── Escritura: objetivos y rutina ──────────────────────────────────────────

  const objetivo = z.object({
    series: z.number().int().min(1).max(10).nullable().optional(),
    reps: z.number().int().min(0).nullable().optional(),
    reps_por_serie: z.array(z.number().int().min(0)).optional().describe("Reps distintas por serie, ej: [12, 10, 8]"),
    peso: z.number().min(0).nullable().optional(),
  });

  tool(server, "guardar_objetivos", {
    title: "Guardar objetivos",
    description: "Guarda objetivos (series, reps o reps_por_serie, peso) por ejercicio para una semana. Por defecto se combinan con los existentes; con reemplazar=true la semana queda sólo con éstos. Usá el nombre del ejercicio tal como está en la rutina; una alternativa lleva sus propios objetivos con su nombre.",
    inputSchema: {
      objetivos: z.record(z.string(), objetivo).describe("{ \"Press Plano Máquina\": { \"series\": 3, \"reps\": 12, \"peso\": 35 } }"),
      semana: z.string().optional().describe("ISO, ej '2026-W44'. Default: semana actual"),
      reemplazar: z.boolean().default(false),
      eliminar: z.array(z.string()).optional().describe("Ejercicios a quitar de los objetivos de esa semana"),
    },
    annotations: WRITE,
  }, async ({ objetivos, semana, reemplazar = false, eliminar = [] }) => {
    const week = checkWeek(semana);
    const { days } = await loadRoutine(store);
    // Incluye las alternativas: cada una tiene sus propios objetivos.
    const routineNames = Object.values(days).flatMap(routineVariantNames);
    const targets = {};
    const renombrados = {};
    for (const [raw, val] of Object.entries(objetivos)) {
      // Sin esto, "press plano" quedaría como un objetivo que la app nunca muestra.
      const name = matchName(routineNames, raw.trim()) ?? raw.trim();
      if (name !== raw) renombrados[raw] = name;
      const t = normalizeTarget(val);
      if (t) targets[name] = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined));
    }
    let base = reemplazar ? {} : (await store.getTargets(week)) || {};
    base = { ...base, ...targets };
    for (const n of eliminar) {
      const name = matchName(Object.keys(base), n);
      if (name) delete base[name];
    }
    await store.overwriteTargets(week, base);
    return { ok: true, semana: week, renombrados, objetivos: base };
  });

  tool(server, "guardar_rutina_dia", {
    title: "Guardar rutina de un día",
    description: "Reemplaza la rutina de un día: la lista de ejercicios en orden (el orden del array ES el de la rutina) con tipo, descanso, notas, carga y alternativas. Afecta a las sesiones nuevas, no a las ya creadas. Las alternativas también se reemplazan: para conservar las que había, volvé a mandarlas (leelas antes con rutina). Cada ejercicio o alternativa puede traer un objetivo, que se guarda en la semana actual con su nombre.",
    inputSchema: {
      dia: z.string().describe(`Día: ${DAY_LIST}`),
      foco: z.string().optional(),
      ejercicios: z.array(z.object({
        nombre: z.string().min(1),
        tipo: tipo.optional(),
        descanso: z.number().int().min(5).max(900).optional().describe("Segundos"),
        notas: z.string().optional(),
        carga: carga.optional(),
        objetivo: objetivo.optional(),
        alternativas: z.array(z.object({
          nombre: z.string().min(1).describe("Nombre propio, distinto de todos los ejercicios y alternativas del día"),
          tipo: tipo.optional().describe("Default: el del principal"),
          descanso: z.number().int().min(5).max(900).optional().describe("Segundos. Default: el del principal"),
          notas: z.string().optional(),
          carga: carga.optional(),
          objetivo: objetivo.optional(),
        })).optional().describe("Otras máquinas o variantes para este lugar de la rutina"),
      })).min(1),
    },
    annotations: DESTRUCTIVE,
  }, async ({ dia: d, foco, ejercicios }) => {
    const dayKey = resolveDay(d);
    if (!dayKey) throw new UserError("Falta el día");
    // Mismo parser que el editor JSON de la app: misma validación y defaults.
    const text = JSON.stringify({ rutina: { [dayKey]: { foco, ejercicios } } });
    const { routine, targets, errors } = parseRoutineText(text);
    if (!routine?.[dayKey]) throw new UserError(errors.join("; ") || "Rutina inválida");

    const { days } = await loadRoutine(store);
    const before = (days[dayKey]?.ejercicios || []).map(e => e.nombre);
    const altsBefore = routineVariantNames(days[dayKey]).filter(n => !before.includes(n));
    const next = { ...days, [dayKey]: { foco: routine[dayKey].foco ?? days[dayKey]?.foco, ejercicios: routine[dayKey].ejercicios } };
    await store.saveRoutine(next);
    const week = weekKeyOf(today());
    if (Object.keys(targets).length) await store.saveTargets(week, targets);

    const after = next[dayKey].ejercicios.map(e => e.nombre);
    const altsAfter = routineVariantNames(next[dayKey]).filter(n => !after.includes(n));
    return {
      ok: true,
      dia: dayKey,
      avisos: errors,
      agregados: after.filter(n => !before.includes(n)),
      quitados: before.filter(n => !after.includes(n)),
      alternativas_agregadas: altsAfter.filter(n => !altsBefore.includes(n)),
      alternativas_quitadas: altsBefore.filter(n => !altsAfter.includes(n)),
      rutina: next[dayKey],
      objetivos_guardados: Object.keys(targets).length ? { semana: week, ejercicios: Object.keys(targets) } : undefined,
    };
  });

  return server;
}
