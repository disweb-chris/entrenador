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
    { name: "Femoral sentado",       type: "compound" },
    { name: "Leg press",             type: "compound" },
    { name: "Extensión cuádriceps",  type: "isolation" },
    { name: "Aducción",              type: "isolation" },
    { name: "Gemelo máquina",        type: "isolation" },
    { name: "Ab machine",            type: "isolation" },
    { name: "Lumbares máquina",      type: "isolation" },
  ],
  martes: [
    { name: "Banco inclinado máquina", type: "compound" },
    { name: "Press plano máquina",     type: "compound" },
    { name: "Aperturas máquina",       type: "isolation" },
    { name: "Press francés",           type: "isolation" },
    { name: "Copa",                    type: "isolation" },
    { name: "Press tríceps fondos",    type: "compound" },
  ],
  mierc: [
    { name: "Press militar",          type: "compound" },
    { name: "Arnold press",           type: "compound" },
    { name: "Elevaciones laterales",  type: "isolation" },
    { name: "Frontal raises Z-bar",   type: "isolation" },
    { name: "Cable shrugs",           type: "isolation" },
    { name: "Leg raises",             type: "isolation" },
    { name: "Ab machine",             type: "isolation" },
    { name: "Lumbares máquina",       type: "isolation" },
    { name: "Russian twist",          type: "isolation" },
    { name: "Plancha lateral",        type: "isolation" },
  ],
  jueves: [
    { name: "Jalón cerrado V",          type: "compound" },
    { name: "Remo en máquina",          type: "compound" },
    { name: "Vuelo trasero",            type: "isolation" },
    { name: "Remo T apoyado",           type: "compound" },
    { name: "Curl predicador barra Z",  type: "isolation" },
    { name: "Curl concentrado",         type: "isolation" },
    { name: "Curl alternado inclinado", type: "isolation" },
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

export const RIR_CONFIG = {
  0: { bg: "#ef4444", text: "#fff", label: "0",   desc: "Fallo" },
  1: { bg: "#f97316", text: "#fff", label: "1",   desc: "Objetivo" },
  2: { bg: "#eab308", text: "#000", label: "2",   desc: "OK" },
  3: { bg: "#22c55e", text: "#fff", label: "3",   desc: "Liviano" },
  4: { bg: "#6b7280", text: "#fff", label: "4+",  desc: "Muy fácil" },
};

export const FATIGUE_CONFIG = {
  1: { bg: "#22c55e", text: "#fff", label: "1", desc: "Fresco" },
  2: { bg: "#84cc16", text: "#000", label: "2", desc: "Leve" },
  3: { bg: "#eab308", text: "#000", label: "3", desc: "Moderada" },
  4: { bg: "#f97316", text: "#fff", label: "4", desc: "Alta" },
  5: { bg: "#ef4444", text: "#fff", label: "5", desc: "Al límite" },
};

export function getTodayDayKey() {
  const d = new Date().getDay();
  const map = { 1: "lunes", 2: "martes", 3: "mierc", 4: "jueves", 5: "viernes" };
  return map[d] || "lunes";
}

export function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function makeEmptySet() {
  return { weight: "", reps: "", rir: null, fatigue: null, done: false, notes: "" };
}
