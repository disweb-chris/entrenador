import { test } from "node:test";
import assert from "node:assert/strict";
import { syncSessionExercises } from "../../src/lib/routine.js";

const empty = () => ({ weight: "", reps: "", rir: null, fatigue: null, done: false, notes: "" });
const done = () => ({ ...empty(), weight: "10", reps: "10", done: true });
const day = { ejercicios: [
  { nombre: "A", tipo: "compound" },
  { nombre: "B", tipo: "isolation", alternativas: [{ nombre: "B2" }] },
  { nombre: "C", tipo: "isolation" },
] };

test("sin cambios devuelve el mismo objeto", () => {
  const ex = { A: { order: 0, sets: [empty(), empty()] }, B: { order: 1, sets: [empty()] } };
  assert.equal(syncSessionExercises(ex, day, { targets: { A: { series: 2 } } }), ex);
});

test("completa series y ordena como la rutina", () => {
  const ex = { C: { order: 0, sets: [empty()] }, A: { order: 1, sets: [done()] } };
  const out = syncSessionExercises(ex, day, { targets: { A: { series: 3 }, C: { series: 2 } } });
  assert.equal(out.A.order, 0);
  assert.equal(out.C.order, 1);
  assert.equal(out.A.sets.length, 3);
  assert.equal(out.A.sets[0].done, true);
  assert.equal(out.C.sets.length, 2);
});

test("una serie extra agregada a mano no se pierde al recargar", () => {
  const ex = { A: { order: 0, sets: [empty(), empty(), empty(), empty()] } };
  assert.equal(syncSessionExercises(ex, day, { targets: { A: { series: 3 } } }), ex);
});

test("con dos variantes en el mismo lugar no completa series", () => {
  const ex = {
    B: { order: 1, sets: [done(), done()] },
    B2: { order: 1.5, variantOf: "B", sets: [empty()] },
  };
  const out = syncSessionExercises(ex, day, { targets: { B: { series: 3 }, B2: { series: 3 } } });
  assert.equal(out.B.sets.length, 2);
  assert.equal(out.B2.sets.length, 1);
  assert.equal(out.B.order, 0);
  assert.equal(out.B2.order, 1);
});
