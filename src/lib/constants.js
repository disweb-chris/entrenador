export const DAYS = [
  { key: "lunes",   label: "LUN", full: "Lunes",      focus: "Piernas + Abs" },
  { key: "martes",  label: "MAR", full: "Martes",     focus: "Pecho + Tríceps" },
  { key: "mierc",   label: "MIÉ", full: "Miércoles",  focus: "Hombros + Abs" },
  { key: "jueves",  label: "JUE", full: "Jueves",     focus: "Espalda + Bíceps" },
  { key: "viernes", label: "VIE", full: "Viernes",    focus: "Full Body + Abs" },
];

// compound = 90s rest, isolation = 60s rest
export const DEFAULT_EXERCISES = {
  lunes: [
    { name: "Femoral sentado",              type: "compound" },
    { name: "Sentadilla en Máquina 11",     type: "compound" },
    { name: "Linear Leg Press",             type: "compound" },
    { name: "Machine Seated Leg Extension", type: "isolation" },
    { name: "Aducción de piernas",          type: "isolation" },
    { name: "Pantorrillas",                 type: "isolation" },
    { name: "Abdominal",                    type: "isolation" },
    { name: "Lumbares",                     type: "isolation" },
    { name: "Abdomen elevaciones",          type: "isolation" },
    { name: "Rusian Twist con mancuernas",  type: "isolation" },
  ],
  martes: [
    { name: "Banco Inclinado Máquina",  type: "compound" },
    { name: "Aperturas en Máquina",     type: "isolation" },
    { name: "Press Plano Máquina",      type: "compound" },
    { name: "Press Francés",            type: "isolation" },
    { name: "Copa",                     type: "isolation" },
    { name: "Fondos Máquina Tríceps",   type: "compound" },
  ],
  mierc: [
    { name: "Press Militar con Barra Sentado",       type: "compound" },
    { name: "Press Arnold con Mancuernas",           type: "compound" },
    { name: "Elevaciones Laterales con Mancuernas",  type: "isolation" },
    { name: "Elevaciones Frontales con Barra Z",     type: "isolation" },
    { name: "Encogimientos en Polea Baja",           type: "isolation" },
    { name: "Abdominal Máquina",                     type: "isolation" },
    { name: "Abdomen Elevaciones",                   type: "isolation" },
    { name: "Lumbares",                              type: "isolation" },
    { name: "Russian Twist con Mancuernas",          type: "isolation" },
    { name: "Plancha Lateral",                       type: "isolation" },
  ],
  jueves: [
    { name: "Jalón Cerrado con V",               type: "compound" },
    { name: "Remo en Máquina",                   type: "compound" },
    { name: "Remo en T Apoyado",                 type: "compound" },
    { name: "Vuelo Trasero de Hombro",           type: "isolation" },
    { name: "Curl en Predicador",                type: "isolation" },
    { name: "Curl Concentrado con Mancuernas",   type: "isolation" },
    { name: "Curl Alternado en Blanco Inclinado", type: "isolation" },
  ],
  viernes: [
    { name: "Press pecho máquina",      type: "compound" },
    { name: "Aperturas máquina",        type: "isolation" },
    { name: "Press tríceps cable",      type: "isolation" },
    { name: "Jalón cerrado V-bar",      type: "compound" },
    { name: "Femoral sentado",          type: "compound" },
    { name: "Leg press",                type: "compound" },
    { name: "Elevaciones laterales",    type: "isolation" },
    { name: "Abductor",                 type: "isolation" },
    { name: "Cable shrugs",             type: "isolation" },
    { name: "Cable crunches",           type: "isolation" },
    { name: "Ab machine",               type: "isolation" },
    { name: "Lumbares máquina",         type: "isolation" },
    { name: "Russian twist",            type: "isolation" },
    { name: "Plancha lateral",          type: "isolation" },
  ],
};

export const REST_DEFAULTS = { compound: 90, isolation: 60 };

// Escala de apilado semántica: el cronómetro de descanso siempre por encima de
// la barra de estado, sin números sueltos tipo 999.
export const Z = { statusBar: 10, restTimer: 20 };

// Los fondos son los de DESIGN.md sin cambios. El color de texto es el unico
// que pasa WCAG AA (4.5:1) sobre cada fondo: blanco sobre naranja da 2.8:1 y
// sobre verde 2.3:1, ilegibles bajo la luz de un gimnasio. Negro sobre rojo,
// ademas, es la convencion de advertencia — no suaviza el estado de fallo.
export const RIR_CONFIG = {
  0: { bg: "#ef4444", text: "#0a0a0a", label: "0",   desc: "Fallo" },
  1: { bg: "#f97316", text: "#0a0a0a", label: "1",   desc: "Objetivo" },
  2: { bg: "#eab308", text: "#0a0a0a", label: "2",   desc: "OK" },
  3: { bg: "#22c55e", text: "#0a0a0a", label: "3",   desc: "Liviano" },
  4: { bg: "#6b7280", text: "#ffffff", label: "4+",  desc: "Muy fácil" },
};

export const FATIGUE_CONFIG = {
  1: { bg: "#22c55e", text: "#0a0a0a", label: "1", desc: "Fresco" },
  2: { bg: "#84cc16", text: "#0a0a0a", label: "2", desc: "Leve" },
  3: { bg: "#eab308", text: "#0a0a0a", label: "3", desc: "Moderada" },
  4: { bg: "#f97316", text: "#0a0a0a", label: "4", desc: "Alta" },
  5: { bg: "#ef4444", text: "#0a0a0a", label: "5", desc: "Al límite" },
};

export function getArgentinaDate(date = new Date()) {
  // UTC-3 fixed offset for Argentina
  const offset = -3 * 60;
  const local = new Date(date.getTime() + (offset - date.getTimezoneOffset()) * 60000);
  return local;
}

export function getTodayDayKey() {
  const d = getArgentinaDate().getDay();
  const map = { 1: "lunes", 2: "martes", 3: "mierc", 4: "jueves", 5: "viernes" };
  return map[d] || "lunes";
}

export function getDateKey(date = new Date()) {
  const d = getArgentinaDate(date);
  return d.toISOString().slice(0, 10);
}

export function makeEmptySet() {
  return { weight: "", reps: "", rir: null, fatigue: null, done: false, notes: "" };
}

// Los ejercicios viven en un map de Firestore, y Firestore devuelve las claves
// de un map ordenadas alfabéticamente. Sin un índice explícito la rutina vuelve
// alfabetizada ("Abdomen elevaciones" antes que "Abdominal"), tanto en la
// pantalla como en el informe. `order` se guarda al crear la sesión; para las
// sesiones viejas que no lo tienen se cae al orden en que el día los define.
export function sortedExercises(exercises, dayKey) {
  const defaults = DEFAULT_EXERCISES[dayKey] || [];
  const fallback = new Map(defaults.map((ex, i) => [ex.name, i]));
  return Object.entries(exercises || {}).sort(([aName, a], [bName, b]) => {
    const ao = a?.order ?? fallback.get(aName) ?? Number.MAX_SAFE_INTEGER;
    const bo = b?.order ?? fallback.get(bName) ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return aName.localeCompare(bName, "es");
  });
}

/**
 * Qué sesión toca abrir. Faltar un día no debería correr la rutina: si el lunes
 * no fuiste, el martes te sigue tocando piernas. Se apoya en lastWorkedDay del
 * perfil, que avanza al registrar la primera serie de una sesión.
 */
export function getNextDayKey(profile, todayDateKey = getDateKey()) {
  const lastDay = profile?.lastWorkedDay;
  const lastDate = profile?.lastWorkedDate;
  if (!lastDay) return getTodayDayKey(); // sin historial, el día del calendario
  // Ya entrenaste hoy: seguís en esa sesión, no en la siguiente.
  if (lastDate === todayDateKey) return lastDay;
  const i = DAYS.findIndex(d => d.key === lastDay);
  if (i === -1) return getTodayDayKey();
  return DAYS[(i + 1) % DAYS.length].key;
}
