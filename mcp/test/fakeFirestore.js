// Firestore en memoria con el subconjunto de la API de firebase-admin que usa store.js.
export function fakeFirestore(seed = {}) {
  const data = new Map(); // "coleccion/id" → objeto
  for (const [col, docs] of Object.entries(seed)) {
    for (const [id, d] of Object.entries(docs)) data.set(`${col}/${id}`, structuredClone(d));
  }
  const snap = (key) => ({
    exists: data.has(key),
    data: () => structuredClone(data.get(key)),
  });
  const docRef = (col, id) => ({
    key: `${col}/${id}`,
    get: async () => snap(`${col}/${id}`),
    set: async (d, opts) => setDoc(`${col}/${id}`, d, opts),
  });
  function setDoc(key, d, opts) {
    const prev = data.get(key);
    data.set(key, structuredClone(opts?.merge && prev ? { ...prev, ...d } : d));
  }
  const query = (col, filters = [], order = null, lim = Infinity) => ({
    where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim),
    orderBy: (f, dir = "asc") => query(col, filters, [f, dir], lim),
    limit: n => query(col, filters, order, n),
    get: async () => {
      let rows = [...data.entries()]
        .filter(([k]) => k.startsWith(`${col}/`))
        .map(([k, d]) => ({ k, d }))
        .filter(({ d }) => filters.every(([f, op, v]) =>
          op === "==" ? d[f] === v : op === "<" ? d[f] < v : op === ">" ? d[f] > v : false));
      if (order) rows.sort((a, b) => (a.d[order[0]] < b.d[order[0]] ? -1 : 1) * (order[1] === "desc" ? -1 : 1));
      rows = rows.slice(0, lim);
      const docs = rows.map(({ k }) => ({ id: k.split("/")[1], data: () => structuredClone(data.get(k)) }));
      return { docs, empty: !docs.length };
    },
  });
  return {
    _data: data,
    collection: col => ({ doc: id => docRef(col, id), ...query(col) }),
    runTransaction: async fn => fn({
      get: async ref => snap(ref.key),
      set: (ref, d, opts) => setDoc(ref.key, d, opts),
    }),
  };
}
