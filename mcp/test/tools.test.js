import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fakeFirestore } from "./fakeFirestore.js";
import { createStore } from "../src/store.js";
import { buildServer } from "../src/tools.js";
import { today, weekKeyOf } from "../src/logic.js";

const UID = "u1";
const set = (weight, reps, extra = {}) => ({ weight: String(weight), reps: String(reps), rir: 1, fatigue: 3, done: true, notes: "", ...extra });
const empty = () => ({ weight: "", reps: "", rir: null, fatigue: null, done: false, notes: "" });

let db, client;

beforeEach(async () => {
  db = fakeFirestore({
    users: { [UID]: { name: "Chris", lastWorkedDay: "mierc", lastWorkedDate: "2026-10-21" } },
    routines: {
      [UID]: { uid: UID, days: { jueves: { foco: "Espalda + Bíceps", ejercicios: [
        { nombre: "Jalón Cerrado con V", tipo: "compound", descanso: 130, notas: "" },
        { nombre: "Remo en T Apoyado", tipo: "compound", descanso: 120, notas: "" },
      ] } } },
    },
    sessions: {
      [`${UID}_2026-10-15_jueves`]: { uid: UID, dateKey: "2026-10-15", dayKey: "jueves", sessionNotes: "", exercises: {
        "Remo en T Apoyado": { type: "compound", order: 1, restTime: 120, notes: "", sets: [set(20, 14), set(20, 14), set(20, 14)] },
        "Jalón Cerrado con V": { type: "compound", order: 0, restTime: 130, notes: "", sets: [set(140, 12, { rir: 2 }), set(140, 12, { rir: 2 })] },
      } },
      [`${UID}_2026-10-22_jueves`]: { uid: UID, dateKey: "2026-10-22", dayKey: "jueves", sessionNotes: "", exercises: {
        "Remo en T Apoyado": { type: "compound", order: 1, restTime: 120, notes: "", sets: [set(20, 14), set(20, 14), empty()] },
        "Jalón Cerrado con V": { type: "compound", order: 0, restTime: 130, notes: "", sets: [set(145, 13, { rir: 2 })] },
      } },
      [`${UID}_2026-10-23_viernes`]: { uid: UID, dateKey: "2026-10-23", dayKey: "viernes", sessionNotes: "", exercises: {
        "Remo en T Apoyado": { type: "compound", order: 3, restTime: 90, notes: "", sets: [empty(), empty()] },
      } },
      // De otro usuario: nunca tiene que aparecer.
      ["otro_2026-10-22_jueves"]: { uid: "otro", dateKey: "2026-10-22", dayKey: "jueves", exercises: { "Remo en T Apoyado": { sets: [set(200, 1)] } } },
    },
    targets: {
      [`${UID}_${weekKeyOf(today())}`]: { uid: UID, weekKey: weekKeyOf(today()), targets: { "Jalón Cerrado con V": { series: 3, reps: 13, peso: 145 } } },
    },
  });
  const server = buildServer(createStore(db, UID));
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
});

async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content[0].text;
  if (r.isError) return { error: text };
  return JSON.parse(text);
}
const doc = id => db._data.get(`sessions/${id}`);

test("lista las herramientas de lectura y escritura", async () => {
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name);
  for (const n of ["sesion_por_fecha", "historial_ejercicio", "rutina", "proxima_sesion", "registrar_set", "editar_set", "guardar_objetivos", "guardar_rutina_dia"]) {
    assert.ok(names.includes(n), n);
  }
});

test("sesion_por_fecha respeta el orden de la rutina", async () => {
  const r = await call("sesion_por_fecha", { fecha: "2026-10-22" });
  assert.deepEqual(r.sesiones[0].ejercicios.map(e => e.nombre), ["Jalón Cerrado con V", "Remo en T Apoyado"]);
  assert.equal(r.sesiones[0].series_hechas, 3);
});

test("historial ignora series sin hacer, sesiones vacías y datos de otros usuarios", async () => {
  const r = await call("historial_ejercicio", { ejercicio: "remo en t" });
  assert.deepEqual(r.sesiones.map(s => s.fecha), ["2026-10-22", "2026-10-15"]);
  assert.equal(r.sesiones[0].series.length, 2);
  assert.equal(r.records["Remo en T Apoyado"].peso, 20);
});

test("historial une 'Facepull' y 'Face Pull'", async () => {
  db._data.get(`sessions/${UID}_2026-10-23_viernes`).exercises["Face Pull"] = { sets: [set(25, 14)] };
  const r = await call("historial_ejercicio", { ejercicio: "facepull" });
  assert.deepEqual(r.nombres_encontrados, ["Face Pull"]);
});

test("registrar_set crea la sesión de hoy desde la rutina con el día de la rotación", async () => {
  const r = await call("registrar_set", { ejercicio: "jalon cerrado con v", peso: 150, reps: 12, rir: 1, fatiga: 3 });
  assert.equal(r.dia, "jueves"); // después de mierc
  assert.equal(r.sesion_creada, true);
  assert.equal(r.ejercicio.nombre, "Jalón Cerrado con V");
  const saved = doc(`${UID}_${today()}_jueves`);
  assert.equal(saved.uid, UID);
  // 3 series pre-creadas por el objetivo; la primera completada.
  const sets = saved.exercises["Jalón Cerrado con V"].sets;
  assert.equal(sets.length, 3);
  assert.deepEqual({ ...sets[0], doneAt: 0 }, { weight: "150", reps: "12", rir: 1, fatigue: 3, done: true, notes: "", doneAt: 0 });
  assert.equal(sets[1].done, false);
  assert.equal(saved.exercises["Remo en T Apoyado"].order, 1);
  assert.equal(r.record.es_record, true);
  assert.deepEqual(db._data.get(`users/${UID}`).lastWorkedDay, "jueves");
});

test("registrar_set en una fecha pasada usa la sesión que ya existe y no toca la rotación", async () => {
  const r = await call("registrar_set", { ejercicio: "Remo en T Apoyado", peso: "20", reps: 13, fecha: "2026-10-22" });
  assert.equal(r.serie_registrada, 3); // completa la pendiente, no agrega una cuarta
  assert.equal(doc(`${UID}_2026-10-22_jueves`).exercises["Remo en T Apoyado"].sets.length, 3);
  assert.equal(db._data.get(`users/${UID}`).lastWorkedDay, "mierc");
});

test("registrar_set agrega un ejercicio nuevo al final", async () => {
  const r = await call("registrar_set", { ejercicio: "Pullover", peso: 30, reps: 12, fecha: "2026-10-22", tipo: "isolation" });
  assert.equal(r.ejercicio_agregado, true);
  assert.equal(doc(`${UID}_2026-10-22_jueves`).exercises.Pullover.order, 2);
});

test("una fecha pasada sin sesión pide el día", async () => {
  const r = await call("registrar_set", { ejercicio: "Remo", peso: 20, reps: 10, fecha: "2026-10-01" });
  assert.match(r.error, /Indicá "dia"/);
});

test("editar_set y eliminar_set", async () => {
  await call("editar_set", { ejercicio: "remo en t apoyado", serie: 2, reps: 15, rir: 0, fecha: "2026-10-22" });
  let sets = doc(`${UID}_2026-10-22_jueves`).exercises["Remo en T Apoyado"].sets;
  assert.equal(sets[1].reps, "15");
  assert.equal(sets[1].rir, 0);
  await call("eliminar_set", { ejercicio: "remo en t apoyado", serie: 3, fecha: "2026-10-22" });
  sets = doc(`${UID}_2026-10-22_jueves`).exercises["Remo en T Apoyado"].sets;
  assert.equal(sets.length, 2);
  const err = await call("editar_set", { ejercicio: "remo en t apoyado", serie: 9, reps: 1, fecha: "2026-10-22" });
  assert.match(err.error, /No existe la serie 9/);
});

test("guardar_objetivos combina y corrige el nombre al de la rutina", async () => {
  const r = await call("guardar_objetivos", { objetivos: { "remo en t apoyado": { series: 3, reps_por_serie: [14, 13, 12], peso: 22.5 } } });
  assert.deepEqual(r.renombrados, { "remo en t apoyado": "Remo en T Apoyado" });
  const t = db._data.get(`targets/${UID}_${weekKeyOf(today())}`).targets;
  assert.deepEqual(t["Remo en T Apoyado"], { series: 3, peso: 22.5, reps_por_serie: [14, 13, 12] });
  assert.ok(t["Jalón Cerrado con V"]);
});

test("guardar_rutina_dia valida con el parser de la app", async () => {
  const r = await call("guardar_rutina_dia", { dia: "Jueves", ejercicios: [
    { nombre: "Remo en T Apoyado", tipo: "compound", descanso: 120 },
    { nombre: "Jalón Cerrado con V", tipo: "compound" },
  ] });
  assert.equal(r.ok, true);
  const days = db._data.get(`routines/${UID}`).days;
  assert.deepEqual(days.jueves.ejercicios.map(e => e.nombre), ["Remo en T Apoyado", "Jalón Cerrado con V"]);
  assert.equal(days.jueves.ejercicios[1].descanso, 90);
  assert.ok(days.lunes.ejercicios.length > 0); // los demás días quedan completos
});

test("proxima_sesion sugiere progresión", async () => {
  const r = await call("proxima_sesion");
  assert.equal(r.dia, "jueves");
  const jalon = r.ejercicios.find(e => e.nombre === "Jalón Cerrado con V");
  assert.equal(jalon.sugerencia.accion, "reps"); // RIR 2 → sumar una rep
});

test("tiempos_descanso sale de la rutina y de la última sesión", async () => {
  const r = await call("tiempos_descanso");
  assert.equal(r["Remo en T Apoyado"].rutina, 120);
  assert.equal(r["Remo en T Apoyado"].ultimo_usado, 90);
});

// ── Alternativas ─────────────────────────────────────────────────────────────

async function withAlternatives() {
  return call("guardar_rutina_dia", { dia: "jueves", ejercicios: [
    { nombre: "Jalón Cerrado con V", tipo: "compound", descanso: 130 },
    { nombre: "Remo en T Apoyado", tipo: "compound", descanso: 120, carga: "total", alternativas: [
      { nombre: "Remo con Mancuerna", carga: "lado", descanso: 90, objetivo: { series: 4, reps: 10, peso: 30 } },
      { nombre: "Remo en Polea Baja" },
    ] },
  ] });
}

test("guardar_rutina_dia guarda alternativas con carga y hereda tipo y descanso", async () => {
  const r = await withAlternatives();
  assert.deepEqual(r.alternativas_agregadas, ["Remo con Mancuerna", "Remo en Polea Baja"]);
  const remo = db._data.get(`routines/${UID}`).days.jueves.ejercicios[1];
  assert.equal(remo.carga, "total");
  assert.deepEqual(remo.alternativas, [
    { nombre: "Remo con Mancuerna", tipo: "compound", descanso: 90, notas: "", carga: "lado" },
    { nombre: "Remo en Polea Baja", tipo: "compound", descanso: 120, notas: "" },
  ]);
  // El objetivo de la alternativa es suyo, con su nombre.
  const t = db._data.get(`targets/${UID}_${weekKeyOf(today())}`).targets;
  assert.equal(t["Remo con Mancuerna"].series, 4);
  assert.equal(t["Remo en T Apoyado"], undefined);

  const rut = await call("rutina", { dia: "jueves" });
  assert.equal(rut.dias.jueves.ejercicios[1].alternativas.length, 2);
});

test("guardar_rutina_dia rechaza una alternativa con el nombre de otro ejercicio del día", async () => {
  const r = await call("guardar_rutina_dia", { dia: "jueves", ejercicios: [
    { nombre: "Jalón Cerrado con V", alternativas: [{ nombre: "Remo en T Apoyado" }] },
    { nombre: "Remo en T Apoyado" },
  ] });
  assert.match(r.avisos.join(" "), /repetido/);
  const jalon = db._data.get(`routines/${UID}`).days.jueves.ejercicios[0];
  assert.equal(jalon.alternativas, undefined);
});

test("registrar_set con una alternativa la cambia en el lugar del principal", async () => {
  await withAlternatives();
  const r = await call("registrar_set", { ejercicio: "remo con mancuerna", peso: 30, reps: 10, rir: 1 });
  assert.equal(r.reemplaza_a, "Remo en T Apoyado");
  assert.equal(r.ejercicio.carga, "lado");
  assert.equal(r.ejercicio.alternativa_de, "Remo en T Apoyado");
  const ex = doc(`${UID}_${today()}_jueves`).exercises;
  assert.equal(ex["Remo en T Apoyado"], undefined);
  assert.equal(ex["Remo con Mancuerna"].order, 1);
  assert.equal(ex["Remo con Mancuerna"].sets.length, 4); // series del objetivo de la alternativa
  assert.equal(ex["Remo con Mancuerna"].restTime, 90);
  // Sin historial propio no es récord: no hereda el del principal.
  assert.equal(r.record.record_anterior, null);
});

test("cambiar de alternativa con series hechas conserva las hechas al lado", async () => {
  await withAlternatives();
  await call("registrar_set", { ejercicio: "Remo en T Apoyado", peso: 20, reps: 14 });
  const r = await call("registrar_set", { ejercicio: "Remo en Polea Baja", peso: 50, reps: 12 });
  assert.equal(r.junto_a, "Remo en T Apoyado");
  const s = await call("sesion_por_fecha", {});
  const names = s.sesiones[0].ejercicios.map(e => e.nombre);
  assert.deepEqual(names, ["Jalón Cerrado con V", "Remo en T Apoyado", "Remo en Polea Baja"]);
  const remoT = s.sesiones[0].ejercicios[1];
  assert.equal(remoT.series_totales, 1); // las pendientes pasaron a la alternativa
});

test("proxima_sesion muestra las alternativas con su propio historial y objetivo", async () => {
  await withAlternatives();
  db._data.get(`sessions/${UID}_2026-10-15_jueves`).exercises["Remo con Mancuerna"] = {
    type: "compound", order: 2, restTime: 75, load: "lado", variantOf: "Remo en T Apoyado", sets: [set(28, 10, { rir: 3 })],
  };
  const r = await call("proxima_sesion");
  const remo = r.ejercicios.find(e => e.nombre === "Remo en T Apoyado");
  assert.equal(remo.carga, "total");
  const [manc, polea] = remo.alternativas;
  assert.equal(manc.nombre, "Remo con Mancuerna");
  assert.equal(manc.carga, "lado");
  assert.deepEqual(manc.ultima_vez, [{ peso: 28, reps: 10, rir: 3 }]); // de otra semana, no de la anterior
  assert.equal(manc.descanso, 75);
  assert.equal(manc.objetivo.peso, 30);
  assert.equal(manc.sugerencia.accion, "up");
  assert.equal(polea.ultima_vez, null);
  // El principal sigue con lo suyo.
  assert.equal(remo.ultima_vez[0].peso, 20);
});
