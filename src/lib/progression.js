// Sobrecarga progresiva: a partir del RIR de la sesión anterior decide si toca
// subir peso, sumar una repetición o sostener la carga. Es el criterio que la
// app venía registrando (RIR por serie) pero no usaba para nada.

// Los compuestos toleran saltos mayores; los de aislamiento progresan más fino.
const STEP = { compound: 2.5, isolation: 1.25 };

// Los discos y las máquinas van de a 0.5kg como mínimo útil.
function roundWeight(n) {
  return Math.round(n * 2) / 2;
}

/**
 * Sugiere peso y reps para la próxima sesión de un ejercicio.
 * Devuelve null si no hay datos suficientes para opinar (sin series hechas,
 * sin peso registrado o sin RIR).
 *
 * Escala de RIR (ver RIR_CONFIG): 0=fallo, 1=objetivo, 2=OK, 3=liviano, 4+=muy fácil.
 */
export function suggestProgression(lastData, type = "isolation") {
  const done = (lastData?.sets || []).filter(
    s => s.done && s.weight !== "" && s.weight != null
  );
  if (!done.length) return null;

  const rirs = done.map(s => s.rir).filter(r => r !== null && r !== undefined);
  if (!rirs.length) return null; // sin RIR no se puede juzgar la intensidad

  const topWeight = Math.max(...done.map(s => parseFloat(s.weight) || 0));
  if (!topWeight) return null;

  // Reps de referencia: las menos hechas al peso más alto, para no sobreestimar.
  const topSets = done.filter(s => (parseFloat(s.weight) || 0) === topWeight);
  const reps = Math.min(...topSets.map(s => parseInt(s.reps) || 0));
  if (!reps) return null;

  const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
  const step = STEP[type] ?? STEP.isolation;

  if (avgRir >= 3.5) {
    return { weight: roundWeight(topWeight + step * 2), reps, action: "up", reason: "muy liviano" };
  }
  if (avgRir >= 2.5) {
    return { weight: roundWeight(topWeight + step), reps, action: "up", reason: "liviano" };
  }
  if (avgRir >= 1.5) {
    return { weight: topWeight, reps: reps + 1, action: "reps", reason: "sumá 1 rep" };
  }
  if (avgRir >= 0.5) {
    return { weight: topWeight, reps, action: "hold", reason: "en objetivo" };
  }
  return { weight: topWeight, reps, action: "hold", reason: "fuiste al fallo · consolidá" };
}

export const SUGGESTION_COLOR = {
  up: "#22c55e",
  reps: "#eab308",
  hold: "#888888",
};
