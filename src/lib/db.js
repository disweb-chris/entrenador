import {
  doc, getDoc, setDoc, collection,
  query, where, orderBy, getDocs, limit
} from "firebase/firestore";
import { db } from "./firebase";

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function setUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

export function sessionId(uid, dateKey, dayKey) {
  return `${uid}_${dateKey}_${dayKey}`;
}

export async function getSession(uid, dateKey, dayKey) {
  const snap = await getDoc(doc(db, "sessions", sessionId(uid, dateKey, dayKey)));
  return snap.exists() ? snap.data() : null;
}

export async function saveSession(uid, dateKey, dayKey, data) {
  await setDoc(
    doc(db, "sessions", sessionId(uid, dateKey, dayKey)),
    { uid, dateKey, dayKey, updatedAt: Date.now(), ...data },
    { merge: true }
  );
}

export async function getSessionForDay(uid, dateKey, dayKey) {
  const todaySnap = await getDoc(doc(db, "sessions", sessionId(uid, dateKey, dayKey)));
  if (todaySnap.exists()) return todaySnap.data();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(dateKey + "T12:00:00");
    d.setDate(d.getDate() - i);
    const pastDate = d.toISOString().slice(0, 10);
    const snap = await getDoc(doc(db, "sessions", sessionId(uid, pastDate, dayKey)));
    if (snap.exists()) return snap.data();
  }
  return null;
}

export async function getLastSession(uid, dayKey, beforeDate) {
  const q = query(
    collection(db, "sessions"),
    where("uid", "==", uid),
    where("dayKey", "==", dayKey),
    where("dateKey", "<", beforeDate),
    orderBy("dateKey", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function getExerciseHistory(uid, exerciseName, limitN = 10) {
  const q = query(
    collection(db, "sessions"),
    where("uid", "==", uid),
    orderBy("dateKey", "desc"),
    limit(30)
  );
  const snap = await getDocs(q);
  const results = [];
  snap.docs.forEach(d => {
    const session = d.data();
    const ex = session.exercises?.[exerciseName];
    if (ex) {
      const doneSets = (ex.sets || []).filter(s => s.done && s.weight);
      if (doneSets.length) {
        const maxWeight = Math.max(...doneSets.map(s => parseFloat(s.weight) || 0));
        const totalVol = doneSets.reduce((a, s) =>
          a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
        results.push({ date: session.dateKey, maxWeight, totalVol, sets: doneSets });
      }
    }
  });
  return results.reverse().slice(-limitN);
}

export async function saveTargets(uid, weekKey, targets) {
  const docRef = doc(db, "targets", `${uid}_${weekKey}`);
  const snap = await getDoc(docRef);
  const existing = snap.exists() ? (snap.data().targets || {}) : {};
  await setDoc(docRef, { uid, weekKey, targets: { ...existing, ...targets } });
}

export async function overwriteTargets(uid, weekKey, targets) {
  await setDoc(doc(db, "targets", `${uid}_${weekKey}`), { uid, weekKey, targets });
}

export async function getTargets(uid, weekKey) {
  const snap = await getDoc(doc(db, "targets", `${uid}_${weekKey}`));
  return snap.exists() ? snap.data().targets : null;
}
