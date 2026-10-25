// Acceso a Firestore con el mismo modelo que src/lib/db.js. Firebase Admin se
// saltea las reglas de seguridad, así que acá cada lectura y escritura queda
// atada al uid configurado: es lo que en la app hacen las reglas.
//
// Recibe la instancia de Firestore desde afuera para poder probarlo con una
// base en memoria (ver test/).

export function createStore(db, uid) {
  if (!uid) throw new Error("Falta el uid del usuario (ENTRENADOR_UID)");

  const sessionId = (dateKey, dayKey) => `${uid}_${dateKey}_${dayKey}`;
  const sessionRef = (dateKey, dayKey) => db.collection("sessions").doc(sessionId(dateKey, dayKey));
  const targetsRef = weekKey => db.collection("targets").doc(`${uid}_${weekKey}`);

  return {
    uid,
    db,
    sessionRef,

    async getProfile() {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    },

    async setProfile(data) {
      await db.collection("users").doc(uid).set(data, { merge: true });
    },

    async getRoutine() {
      const snap = await db.collection("routines").doc(uid).get();
      return snap.exists ? (snap.data().days || null) : null;
    },

    // Igual que saveRoutine de la app: el documento se reemplaza entero.
    async saveRoutine(days) {
      await db.collection("routines").doc(uid).set({ uid, days, updatedAt: Date.now() });
    },

    async getSession(dateKey, dayKey) {
      const snap = await sessionRef(dateKey, dayKey).get();
      return snap.exists ? snap.data() : null;
    },

    /** Todas las sesiones de una fecha: puede haber más de una si se entrenaron dos días de rutina. */
    async getSessionsByDate(dateKey) {
      const snap = await db.collection("sessions")
        .where("uid", "==", uid)
        .where("dateKey", "==", dateKey)
        .get();
      return snap.docs.map(d => d.data());
    },

    /** Requiere el índice (uid, dateKey desc) de firestore.indexes.json. */
    async getRecentSessions(limitN = 60) {
      const snap = await db.collection("sessions")
        .where("uid", "==", uid)
        .orderBy("dateKey", "desc")
        .limit(limitN)
        .get();
      return snap.docs.map(d => d.data());
    },

    /** Requiere el índice (uid, dayKey, dateKey desc). */
    async getLastSession(dayKey, beforeDate) {
      const snap = await db.collection("sessions")
        .where("uid", "==", uid)
        .where("dayKey", "==", dayKey)
        .where("dateKey", "<", beforeDate)
        .orderBy("dateKey", "desc")
        .limit(1)
        .get();
      return snap.empty ? null : snap.docs[0].data();
    },

    async getTargets(weekKey) {
      const snap = await targetsRef(weekKey).get();
      return snap.exists ? (snap.data().targets || null) : null;
    },

    async saveTargets(weekKey, targets) {
      const ref = targetsRef(weekKey);
      const snap = await ref.get();
      const existing = snap.exists ? (snap.data().targets || {}) : {};
      await ref.set({ uid, weekKey, targets: { ...existing, ...targets } });
    },

    async overwriteTargets(weekKey, targets) {
      await targetsRef(weekKey).set({ uid, weekKey, targets });
    },

    /**
     * Lee, modifica y guarda una sesión en una transacción. `mutate` recibe la
     * sesión actual (o null) y devuelve la nueva; devolver null no escribe nada.
     */
    async updateSession(dateKey, dayKey, mutate) {
      const ref = sessionRef(dateKey, dayKey);
      return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const current = snap.exists ? snap.data() : null;
        const next = await mutate(current);
        if (!next) return current;
        const data = { ...next, uid, dateKey, dayKey, updatedAt: Date.now() };
        tx.set(ref, data);
        return data;
      });
    },
  };
}
