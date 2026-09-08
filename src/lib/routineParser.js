import { DAYS, REST_DEFAULTS } from "./constants";

// Parsea lo que se pega en la pestaña de rutina. Tres formatos, en orden de
// expresividad:
//
//   1. { "rutina": { "lunes": { "foco": ..., "ejercicios": [...] } } }
//      Define la rutina completa de un día: orden (el del array), tipo,
//      descanso y objetivo por ejercicio.
//   2. { "Press": { "series": 3, "reps": 8, "peso": 80 } }
//      Sólo objetivos. El formato que ya existía.
//   3. "Press: 3x8@80kg" línea por línea.
//      Sigue siendo lo más rápido para un retoque suelto.
//
// Devuelve { routine, targets, errors } — routine null si el texto no define
// rutina, para que el llamador sepa si tiene que tocar el documento de rutina.

const DAY_KEYS = new Set(DAYS.map(d => d.key));

// "lunes", "Lunes", "MIÉ", "miercoles" → la clave interna del día.
const DAY_ALIASES = (() => {
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const map = new Map();
  for (const d of DAYS) {
    map.set(norm(d.key), d.key);
    map.set(norm(d.full), d.key);
    map.set(norm(d.label), d.key);
  }
  map.set("miercoles", "mierc");
  return { map, norm };
})();

function resolveDay(raw) {
  return DAY_ALIASES.map.get(DAY_ALIASES.norm(String(raw).trim())) ?? null;
}

const num = v => (v == null || v === "" ? null : Number(v));

// ── Objetivos ─────────────────────────────────────────────────────────────────

export function parseSpec(spec) {
  if (!spec) return null;
  const s = String(spec).trim();

  // "3x8@80kg", "3x8 @ 80.5", "3×8@80"
  const m1 = s.match(/^(\d+)\s*[x×X]\s*(\d+)(?:\s*[@a]\s*([\d.]+))?/i);
  if (m1) {
    return { series: parseInt(m1[1]), reps: parseInt(m1[2]), peso: m1[3] ? parseFloat(m1[3]) : null };
  }
  // "3 series de 8 reps con 80kg"
  const m2 = s.match(/(\d+)\s*series?\s*(?:de|x|×|por)?\s*(\d+)\s*(?:reps?)?\s*(?:con|@|a|de)\s*([\d.]+)/i);
  if (m2) {
    return { series: parseInt(m2[1]), reps: parseInt(m2[2]), peso: parseFloat(m2[3]) };
  }
  // "3 series de 8"
  const m3 = s.match(/(\d+)\s*series?\s*(?:de|x|×|por)?\s*(\d+)\s*(?:reps?)?/i);
  if (m3) {
    return { series: parseInt(m3[1]), reps: parseInt(m3[2]), peso: null };
  }
  return null;
}

function normalizeTarget(val) {
  if (!val || typeof val !== "object") return null;
  const series = num(val.series ?? val.sets);
  const peso = num(val.peso ?? val.weight ?? val.kg);
  const target = { series, peso };
  if (Array.isArray(val.reps_por_serie) && val.reps_por_serie.length) {
    target.reps_por_serie = val.reps_por_serie.map(Number);
  } else {
    target.reps = num(val.reps);
  }
  return target;
}

// ── Formato de rutina ─────────────────────────────────────────────────────────

function parseRoutineObject(rutina, errors) {
  const routine = {};
  const targets = {};

  for (const [rawDay, value] of Object.entries(rutina)) {
    const dayKey = resolveDay(rawDay);
    if (!dayKey || !DAY_KEYS.has(dayKey)) {
      errors.push(`Día desconocido: "${rawDay}"`);
      continue;
    }
    // Acepta { ejercicios: [...] } o el array directo.
    const list = Array.isArray(value) ? value : value?.ejercicios;
    if (!Array.isArray(list)) {
      errors.push(`"${rawDay}": falta la lista de ejercicios`);
      continue;
    }

    const ejercicios = [];
    const seen = new Set();
    list.forEach((raw, i) => {
      const item = typeof raw === "string" ? { nombre: raw } : raw;
      const nombre = String(item?.nombre ?? item?.ejercicio ?? item?.name ?? "").trim();
      if (!nombre) {
        errors.push(`"${rawDay}" #${i + 1}: sin nombre`);
        return;
      }
      if (seen.has(nombre)) {
        errors.push(`"${rawDay}": "${nombre}" repetido`);
        return;
      }
      seen.add(nombre);

      const tipo = item.tipo === "compound" || item.tipo === "isolation" ? item.tipo : "isolation";
      const descanso = num(item.descanso ?? item.rest ?? item.restTime);
      ejercicios.push({
        nombre,
        tipo,
        descanso: descanso != null && descanso > 0 ? descanso : (REST_DEFAULTS[tipo] ?? 60),
        notas: String(item.notas ?? item.nota ?? "").trim(),
      });

      // El objetivo viaja junto al ejercicio pero se guarda aparte: la rutina es
      // permanente y los objetivos son de la semana.
      const objetivo = item.objetivo ?? item.target;
      const t = objetivo ? normalizeTarget(objetivo) : null;
      if (t && (t.series != null || t.peso != null || t.reps != null || t.reps_por_serie)) {
        targets[nombre] = t;
      }
    });

    if (!ejercicios.length) {
      errors.push(`"${rawDay}": ningún ejercicio válido, no se aplica`);
      continue;
    }
    routine[dayKey] = {
      foco: value?.foco != null ? String(value.foco).trim() : undefined,
      ejercicios,
    };
  }

  return { routine: Object.keys(routine).length ? routine : null, targets };
}

// ── Entrada principal ─────────────────────────────────────────────────────────

export function parseRoutineText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { routine: null, targets: {}, errors: [] };
  const errors = [];

  if (text.startsWith("{")) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      return { routine: null, targets: {}, errors: [`JSON inválido: ${err.message}`] };
    }
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      if (obj.rutina || obj.routine) {
        const parsed = parseRoutineObject(obj.rutina ?? obj.routine, errors);
        return { ...parsed, errors };
      }
      // Formato viejo: sólo objetivos, con o sin envoltorio { targets: ... }.
      const flat = (obj.targets && typeof obj.targets === "object" && !Array.isArray(obj.targets))
        ? obj.targets : obj;
      const targets = {};
      for (const [name, val] of Object.entries(flat)) {
        const n = name.trim();
        if (!n) continue;
        const t = normalizeTarget(val);
        if (t) targets[n] = t;
        else errors.push(`"${n}": valor no reconocido`);
      }
      return { routine: null, targets, errors };
    }
    return { routine: null, targets: {}, errors: ["El JSON debe ser un objeto"] };
  }

  // Línea por línea.
  const targets = {};
  for (let line of text.split("\n")) {
    line = line.trim().replace(/^[-*•]\s*/, "");
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      const m = line.match(/^(.+?)\s+(\d+\s*[x×X]\s*\d+.*)$/i);
      const parsed = m && parseSpec(m[2]);
      if (parsed) { targets[m[1].trim()] = parsed; continue; }
      errors.push(`Sin separador: "${line}"`);
      continue;
    }

    const name = line.slice(0, colonIdx).trim();
    const spec = line.slice(colonIdx + 1).trim();
    if (!name) { errors.push(`Nombre vacío: "${line}"`); continue; }

    const parsed = parseSpec(spec);
    if (parsed) targets[name] = parsed;
    else errors.push(`"${name}": no reconocido ("${spec}")`);
  }

  return { routine: null, targets, errors };
}
