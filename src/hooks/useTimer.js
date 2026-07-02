import { useState, useEffect, useRef, useCallback } from "react";
import { playWarning, playDone, vibrate } from "../lib/sound";

// Ambos timers calculan el tiempo desde timestamps (Date.now()) en vez de
// contar ticks: los navegadores móviles pausan/throttlean setInterval con la
// pantalla bloqueada, y contar ticks haría que el timer "se congele".

export function useRestTimer() {
  const [active, setActive] = useState(false);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const endRef = useRef(0);
  const intervalRef = useRef(null);
  const warnedRef = useRef(false);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 5 && left > 0 && !warnedRef.current) {
      warnedRef.current = true;
      playWarning();
      vibrate([80, 40, 80]);
    }
    if (left <= 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setActive(false);
      playDone();
      vibrate([200, 100, 200]);
    }
  }, []);

  const start = useCallback((seconds) => {
    clearInterval(intervalRef.current);
    warnedRef.current = false;
    endRef.current = Date.now() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
    setActive(true);
    intervalRef.current = setInterval(tick, 250);
  }, [tick]);

  const skip = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setActive(false);
    setTotal(0);
    setRemaining(0);
    warnedRef.current = false;
  }, []);

  // Al volver del background, re-sincronizar de inmediato (y sonar si venció)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && intervalRef.current) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tick]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  return { active, remaining, total, pct, start, skip };
}

const SESSION_KEY = "overload_session_start";
const SESSION_CAP = 28800; // 8h: sesiones olvidadas no acumulan para siempre

function elapsedFrom(startMs) {
  return Math.min(Math.floor((Date.now() - startMs) / 1000), SESSION_CAP);
}

export function useSessionTimer() {
  const [startMs, setStartMs] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const ms = parseInt(saved);
    return elapsedFrom(ms) < SESSION_CAP ? ms : null;
  });
  const [elapsed, setElapsed] = useState(() => (startMs ? elapsedFrom(startMs) : 0));

  const startSession = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(SESSION_KEY, now.toString());
    setStartMs(now);
    setElapsed(0);
  }, []);

  const stopSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setStartMs(null);
  }, []);

  useEffect(() => {
    if (startMs === null) return;
    const tick = () => setElapsed(elapsedFrom(startMs));
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [startMs]);

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return { elapsed, formatted: fmt(elapsed), running: startMs !== null, startSession, stopSession };
}
