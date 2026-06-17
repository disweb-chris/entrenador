import { useState, useEffect, useRef, useCallback } from "react";
import { playWarning, playDone, vibrate } from "../lib/sound";

export function useRestTimer() {
  const [active, setActive] = useState(false);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef(null);
  const warnedRef = useRef(false);

  const clear = useCallback(() => {
    clearInterval(intervalRef.current);
    setActive(false);
    warnedRef.current = false;
  }, []);

  const start = useCallback((seconds) => {
    clear();
    setTotal(seconds);
    setRemaining(seconds);
    warnedRef.current = false;
    setActive(true);
  }, [clear]);

  const skip = useCallback(() => {
    clear();
    setRemaining(0);
  }, [clear]);

  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next === 5 && !warnedRef.current) {
          warnedRef.current = true;
          playWarning();
          vibrate([80, 40, 80]);
        }
        if (next <= 0) {
          clearInterval(intervalRef.current);
          setActive(false);
          playDone();
          vibrate([200, 100, 200]);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [active]);

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  return { active, remaining, total, pct, start, skip };
}

const SESSION_KEY = "overload_session_start";

export function useSessionTimer() {
  const savedStart = localStorage.getItem(SESSION_KEY);
  const initialElapsed = savedStart
    ? Math.min(Math.floor((Date.now() - parseInt(savedStart)) / 1000), 28800)
    : 0;
  const initialRunning = !!savedStart && initialElapsed < 28800;

  const [elapsed, setElapsed] = useState(initialElapsed);
  const [running, setRunning] = useState(initialRunning);
  const ref = useRef(null);

  const startSession = useCallback(() => {
    localStorage.setItem(SESSION_KEY, Date.now().toString());
    setElapsed(0);
    setRunning(true);
  }, []);

  const stopSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(ref.current);
  }, [running]);

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return { elapsed, formatted: fmt(elapsed), running, startSession, stopSession };
}
