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
