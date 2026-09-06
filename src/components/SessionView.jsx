import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { DAYS, DEFAULT_EXERCISES, getDateKey, getTodayDayKey, getNextDayKey, sortedExercises, makeEmptySet, Z } from "../lib/constants";
import { saveSession, getSession, getSessionForDay, getLastSession, getTargets, overwriteTargets, getRecentSessions, exerciseHistoryFrom, setUserProfile } from "../lib/db";
import { generateReport, getWeekKey } from "../lib/report";
import { useRestTimer, useSessionTimer } from "../hooks/useTimer";
import { useWakeLock } from "../hooks/useWakeLock";
import ExerciseCard from "./ExerciseCard";
import RestTimer from "./RestTimer";
import ObjetivosTab from "./ObjetivosTab";
import SessionPicker from "./SessionPicker";
import { computeBests } from "../lib/records";

export default function SessionView({ user, profile, onSignOut }) {
  const dateKey = getDateKey();

  // Arranca en la sesión que toca según la rotación, no según el calendario:
  // faltar un día no debería correr la rutina. Abrir la app no cuesta un tap.
  const [activeDay, setActiveDay] = useState(() => getNextDayKey(profile, dateKey));
  const [activeDateKey, setActiveDateKey] = useState(dateKey);
  // Fecha que se está mirando; null es la sesión de hoy. Va en estado y no en
  // un argumento suelto para que el efecto de carga sea la única puerta de
  // entrada: si no, elegir del historial dispara dos loadDay que compiten.
  const [viewDate, setViewDate] = useState(null);
  // Si el usuario elige un día a mano, deja de ser la sugerencia de la rotación.
  const [autoSelected, setAutoSelected] = useState(true);
  const [session, setSession] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("session");
  const [reportText, setReportText] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExType, setNewExType] = useState("isolation");
  const [sessionNotes, setSessionNotes] = useState("");
  const [copied, setCopied] = useState(false);
  // Sesiones recientes: una sola lectura alimenta récords, historial y gráficos.
  const [recent, setRecent] = useState(null);
  const [recentError, setRecentError] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const timer = useRestTimer();
  const sessionTimer = useSessionTimer();
  useWakeLock(sessionTimer.running);

  // ── Auto-guardado con debounce ─────────────────────────────────────────────
  // Cada edición actualiza el estado al instante; la escritura a Firestore se
  // difiere 800ms para no escribir por cada tecla. pendingRef guarda lo no
  // escrito para poder hacer flush al cambiar de día o cerrar la app.
  const saveTimerRef = useRef(null);
  const pendingRef = useRef(null);
  const skipSaveRef = useRef(true);

  const flushSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    saveSession(p.uid, p.dateKey, p.dayKey, p.session)
      .catch(err => console.error("Error guardando sesión:", err));
  }, []);

  useEffect(() => {
    if (!session || !activeDay) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    pendingRef.current = { uid: user.uid, dateKey: activeDateKey, dayKey: activeDay, session };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 800);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    if (!activeDay) { setLoading(false); return; }
    loadDay(activeDay, viewDate);
  }, [activeDay, viewDate]);

  // Historial completo: alimenta los récords, el selector de sesiones y los
  // gráficos con una sola lectura en vez de una consulta por ejercicio.
  useEffect(() => {
    let cancelled = false;
    getRecentSessions(user.uid)
      .then(rows => { if (!cancelled) { setRecent(rows); setRecentError(null); } })
      .catch(err => {
        if (cancelled) return;
        console.error("No se pudo leer el historial:", err);
        // Firestore devuelve el link para crear el índice dentro del mensaje.
        setRecentError({
          indexUrl: err?.code === "failed-precondition"
            ? err.message.match(/https:\/\/\S+/)?.[0]?.replace(/[).]+$/, "") ?? null
            : null,
        });
        setRecent([]);
      });
    return () => { cancelled = true; };
  }, [user.uid]);

  /**
   * Carga una sesión. Sin `targetDate` es la de hoy; con `targetDate` es una
   * sesión pasada, que se abre editable para poder corregirla.
   */
  async function loadDay(dayKey, targetDate = null) {
    flushSave(); // no perder ediciones pendientes del día anterior
    setLoading(true);
    const viewingDate = targetDate || dateKey;
    const isPast = viewingDate !== dateKey;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const [snap, tgts, nextTgts, lastTgts] = await Promise.all([
      isPast ? getSession(user.uid, viewingDate, dayKey)
             : getSessionForDay(user.uid, dateKey, dayKey),
      getTargets(user.uid, getWeekKey()),
      getTargets(user.uid, getWeekKey(nextWeek)),
      getTargets(user.uid, getWeekKey(lastWeek)),
    ]);

    // Only use a saved session if it belongs to the date being viewed; older
    // ones are reference material, not the session you are editing.
    const loaded = snap?.dateKey === viewingDate ? snap : null;
    const last = await getLastSession(user.uid, dayKey, viewingDate);

    skipSaveRef.current = true; // lo que viene de la DB no hay que re-escribirlo
    if (loaded) {
      setSession(loaded);
      setActiveDateKey(viewingDate);
      setSessionNotes(loaded.sessionNotes || "");
    } else {
      const defaults = DEFAULT_EXERCISES[dayKey] || [];
      const exercises = {};
      defaults.forEach((ex, idx) => {
        // Hereda el descanso configurado en la sesión anterior de este día
        const prevRest = last?.exercises?.[ex.name]?.restTime ?? null;
        // `order` explícito: Firestore devuelve las claves del map alfabetizadas.
        exercises[ex.name] = { type: ex.type, order: idx, sets: [makeEmptySet()], notes: "", restTime: prevRest };
      });
      setSession({ exercises, sessionNotes: "" });
      setActiveDateKey(viewingDate);
      setSessionNotes("");
    }

    setLastSession(last);
    // Si no hay targets esta semana, usar los de la semana pasada como base
    const baseTgts = tgts || lastTgts || {};
    setTargets({ ...baseTgts, ...(nextTgts || {}) });
    setLoading(false);
  }

  // Updates funcionales: varios ExerciseCard pueden actualizar en el mismo
  // ciclo (ej. auto-fill al montar) sin pisarse entre sí.
  function updateExercise(name, data) {
    setSession(prev => ({ ...prev, exercises: { ...prev.exercises, [name]: data } }));
  }

  function deleteExercise(name) {
    setSession(prev => {
      const { [name]: _, ...rest } = prev.exercises;
      return { ...prev, exercises: rest };
    });
  }

  function addExercise() {
    const exName = newExName.trim();
    if (!exName) return;
    setSession(prev => ({
      ...prev,
      exercises: {
        ...prev.exercises,
        [exName]: {
          type: newExType, sets: [makeEmptySet()], notes: "",
          // Al final de la rutina, que es donde lo estás agregando.
          order: Object.keys(prev.exercises || {}).length,
          restTime: lastSession?.exercises?.[exName]?.restTime ?? null,
        },
      },
    }));
    setNewExName("");
    setShowAddExercise(false);
  }

  function handleStartRest(seconds) {
    if (!sessionTimer.running) sessionTimer.startSession();
    timer.start(seconds);
  }

  // El gráfico se arma con el historial que ya está en memoria: antes cada
  // tarjeta que abrías disparaba su propia consulta de 30 documentos.
  const loadHistory = useCallback(
    async (exName) => exerciseHistoryFrom(recent, exName),
    [recent]
  );

  function handleAdjustTimer(delta) {
    timer.start(Math.max(5, timer.remaining + delta));
  }

  const stats = (() => {
    if (!session) return { totalSets: 0, doneSets: 0, totalVol: 0, pct: 0 };
    let totalSets = 0, doneSets = 0, totalVol = 0;
    Object.values(session.exercises || {}).forEach(ex => {
      (ex.sets || []).forEach(s => {
        totalSets++;
        if (s.done) {
          doneSets++;
          totalVol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
        }
      });
    });
    return { totalSets, doneSets, totalVol, pct: totalSets ? Math.round((doneSets / totalSets) * 100) : 0 };
  })();

  // La rotación avanza con la primera serie registrada de la sesión: es la señal
  // más confiable de que la hiciste, sin depender de que toques FINALIZAR.
  const routineMarkedRef = useRef(false);
  useEffect(() => { routineMarkedRef.current = false; }, [activeDay, activeDateKey]);
  useEffect(() => {
    // Corregir una sesión pasada no avanza la rotación.
    if (routineMarkedRef.current || stats.doneSets === 0 || !activeDay) return;
    if (activeDateKey !== dateKey) return;
    routineMarkedRef.current = true;
    setUserProfile(user.uid, { lastWorkedDay: activeDay, lastWorkedDate: activeDateKey })
      .catch(err => console.error("No se pudo registrar el avance de la rutina:", err));
  }, [stats.doneSets, activeDay, activeDateKey, user.uid]);

  // La sesión que estás editando se excluye: si no, cada serie se compararía
  // contra sí misma y nunca habría récord.
  const bests = useMemo(
    () => computeBests(recent, activeDateKey),
    [recent, activeDateKey]
  );

  function pickSession(picked) {
    setShowPicker(false);
    setAutoSelected(false);
    setView("session");
    // Los dos setState se agrupan en un render, así que el efecto de carga
    // corre una sola vez y ya con el día y la fecha nuevos.
    setActiveDay(picked.dayKey);
    setViewDate(picked.dateKey === dateKey ? null : picked.dateKey);
  }

  function buildReport() {
    if (!session) return;
    const text = generateReport({
      session,
      lastSession,
      dayKey: activeDay,
      dateKey: activeDateKey,
      sessionDuration: sessionTimer.formatted,
      userName: profile?.name || user.email,
      bests,
    });
    setReportText(text);
    setView("report");
  }

  function copyReport() {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTargetChange(exName, updated) {
    const newTargets = { ...(targets || {}), [exName]: updated };
    setTargets(newTargets);
    overwriteTargets(user.uid, getWeekKey(), newTargets);
  }

  function handleTargetRemove(exName) {
    const { [exName]: _, ...rest } = (targets || {});
    setTargets(rest);
    overwriteTargets(user.uid, getWeekKey(), rest);
  }

  function handleTargetsMerge(newTargets) {
    const merged = { ...(targets || {}), ...newTargets };
    setTargets(merged);
    overwriteTargets(user.uid, getWeekKey(), merged);
  }

  const dayInfo = DAYS.find(d => d.key === activeDay);
  const isPastSession = viewDate !== null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0",
      fontFamily: "'DM Mono', monospace", fontSize: "15px", paddingBottom: "90px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #222; }
        input, textarea { box-sizing: border-box; }
        button { touch-action: manipulation; transition: transform 120ms ease-out; }
        button:active { transform: scale(0.97); }
        @keyframes nudge-up { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .day-nudge { animation: nudge-up 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { button { transition: none; } .day-nudge { animation: none; } }
      `}</style>

      <RestTimer timer={timer} onSkip={timer.skip} onAdjust={handleAdjustTimer} />

      {showPicker && (
        <SessionPicker
          sessions={recent}
          activeDateKey={activeDateKey}
          todayDateKey={dateKey}
          loading={recent === null}
          error={recentError}
          onPick={pickSession}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* HEADER */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #1a1a1a" }}>
        {/* El wordmark cede tamaño al dato: a 38px no entraba junto al volumen
            en pantallas de 320px, y competía con las cifras que son el contenido. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: "26px", letterSpacing: "4px", lineHeight: 1, flexShrink: 0 }}>OVERLOAD</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: "28px", lineHeight: 1, color: stats.totalVol > 0 ? "#f0f0f0" : "#555" }}>
            {stats.totalVol > 0 ? `${stats.totalVol.toLocaleString()}kg` : "—"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "2px" }}>
          {/* La fecha no se trunca: en una app de un solo usuario dice más que el
              nombre, y en 320px sólo entra uno de los dos. */}
          <div style={{ color: "#888", fontSize: "13px", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.name || user.email}
            </span>
            {/* Revisar o corregir una sesión anterior es navegar entre sesiones,
                no otra vista de la actual: por eso cuelga de la fecha y no de
                la fila de HOY / INFORME / OBJETIVOS. */}
            <button onClick={() => setShowPicker(true)}
              aria-haspopup="dialog"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: isPastSession ? "#eab308" : "#888",
                fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px",
                minHeight: "44px", padding: "0 2px", flexShrink: 0,
              }}>
              · {activeDateKey} ▾
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ fontSize: "13px", color: sessionTimer.running ? "#22c55e" : "#888", letterSpacing: "0.5px" }}>
              {sessionTimer.running ? `⏱ ${sessionTimer.formatted}` : "sin iniciar"}
            </span>
            {/* Vivía al final del carrusel de días, donde quedaba fuera de pantalla
                en todo teléfono: había que scrollear la tira para poder salir. */}
            <button onClick={onSignOut}
              style={{
                background: "transparent", border: "none", color: "#888",
                fontFamily: "'DM Mono'", fontSize: "12px", letterSpacing: "1px",
                cursor: "pointer", minHeight: "44px", minWidth: "44px", padding: "0 0 0 6px",
              }}>
              SALIR
            </button>
          </div>
        </div>

        <div style={{ marginTop: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#888", fontSize: "12px", letterSpacing: "2px" }}>PROGRESO</span>
            <span style={{ color: stats.pct === 100 ? "#22c55e" : "#ccc", fontSize: "13px" }}>
              {stats.doneSets}/{stats.totalSets} · {stats.pct}%
            </span>
          </div>
          <div style={{ height: "5px", background: "#1a1a1a", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "3px",
              background: stats.pct === 100 ? "#22c55e" : "linear-gradient(90deg,#3b82f6,#22c55e)",
              width: "100%",
              transform: `scaleX(${stats.pct / 100})`,
              transformOrigin: "left center",
              transition: "transform 0.4s ease-out",
            }} />
          </div>
        </div>
      </div>

      {/* DAY SELECTOR */}
      <div style={{ padding: "8px 18px", display: "flex", gap: "8px", overflowX: "auto", borderBottom: "1px solid #1a1a1a" }}>
        {DAYS.map(d => (
          <button key={d.key}
            onClick={() => { setActiveDay(d.key); setViewDate(null); setAutoSelected(false); setView("session"); }}
            style={{
              padding: "0 14px", minHeight: "44px", borderRadius: "6px", border: "1px solid",
              borderColor: activeDay === d.key ? "#f0f0f0" : "#1e1e1e",
              background: activeDay === d.key ? "#f0f0f0" : "transparent",
              color: activeDay === d.key ? "#0a0a0a" : "#ccc",
              fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
            aria-current={activeDay === d.key ? "true" : undefined}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Editar una sesión vieja sin que se note llevaría a cargar el
          entrenamiento de hoy sobre la fecha equivocada. */}
      {isPastSession && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: "12px", padding: "0 18px", background: "#111",
          borderBottom: "1px solid #1a1a1a",
        }}>
          <span style={{ color: "#eab308", fontSize: "12px", letterSpacing: "1px" }}>
            EDITANDO UNA SESIÓN ANTERIOR
          </span>
          <button onClick={() => { setViewDate(null); setAutoSelected(false); }}
            style={{
              background: "transparent", border: "none", color: "#eab308",
              fontFamily: "'DM Mono'", fontSize: "12px", letterSpacing: "1px",
              cursor: "pointer", minHeight: "44px", padding: "0 2px",
            }}>
            VOLVER A HOY →
          </button>
        </div>
      )}

      {/* DAY TITLE */}
      <div style={{ padding: "14px 18px 8px", display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: "22px", letterSpacing: "2px" }}>{dayInfo?.full}</span>
        <span style={{ color: "#888", fontSize: "13px", letterSpacing: "1px" }}>{dayInfo?.focus?.toUpperCase()}</span>
        {/* Abrir en una sesión que no es la del calendario sin decir por qué
            sería confuso: el sistema dice en qué estado está. */}
        {autoSelected && activeDay !== getTodayDayKey() && (
          <span style={{ color: "#888", fontSize: "12px", letterSpacing: "1px" }}>· TE TOCA ESTA</span>
        )}
      </div>

      {/* VIEW TABS — fila propia: compartiendo línea con el título del día se
          superponían a 393px, el ancho de teléfono más común. */}
      <div style={{ padding: "0 18px", display: "flex", borderBottom: "1px solid #1a1a1a" }}>
        {["session", "report", "targets"].map(v => (
          <button key={v}
            onClick={() => { if (v === "report") buildReport(); else setView(v); }}
            style={{
              flex: 1, minHeight: "44px", background: "transparent", border: "none",
              fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px",
              textTransform: "uppercase", cursor: "pointer",
              color: view === v ? "#f0f0f0" : "#888",
              boxShadow: view === v ? "inset 0 -2px 0 #f0f0f0" : "none",
            }}
            aria-current={view === v ? "page" : undefined}>
            {v === "session" ? "HOY" : v === "report" ? "INFORME" : "OBJETIVOS"}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "8px 18px" }}>
        {!activeDay ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="day-nudge" style={{ color: "#444", fontSize: "20px", marginBottom: "10px" }}>↑</div>
            <div style={{ color: "#555", letterSpacing: "2px", fontSize: "14px" }}>SELECCIONÁ UN DÍA</div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#555", letterSpacing: "3px", fontSize: "14px" }}>CARGANDO...</div>
        ) : view === "session" ? (
          <>
            <textarea
              // El placeholder largo se partía en dos líneas y quedaba cortado
              // dentro del alto de una fila.
              placeholder="Notas de la sesión"
              value={sessionNotes}
              onChange={e => {
                const value = e.target.value;
                setSessionNotes(value);
                setSession(prev => ({ ...prev, sessionNotes: value }));
              }}
              rows={1}
              style={{
                width: "100%", marginBottom: "12px", background: "#0f0f0f",
                border: "1px solid #1a1a1a", color: "#ccc", padding: "12px 14px",
                borderRadius: "8px", fontFamily: "'DM Mono'", fontSize: "16px",
                minHeight: "44px", resize: "none", outline: "none",
              }}
            />

            {sortedExercises(session?.exercises, activeDay).map(([name, data]) => (
              <ExerciseCard
                key={name}
                name={name}
                type={data.type || "isolation"}
                data={data}
                lastData={lastSession?.exercises?.[name]}
                target={targets?.[name]}
                onUpdate={(updated) => updateExercise(name, updated)}
                onDelete={() => deleteExercise(name)}
                onStartRest={handleStartRest}
                loadHistory={loadHistory}
                best={bests[name]}
              />
            ))}

            {showAddExercise ? (
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "12px", padding: "16px", marginBottom: "10px" }}>
                <input
                  placeholder="Nombre del ejercicio"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addExercise()}
                  autoFocus
                  style={{ ...inputBase, width: "100%", marginBottom: "10px" }}
                />
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  {["compound", "isolation"].map(t => (
                    <button key={t}
                      onClick={() => setNewExType(t)}
                      style={{
                        flex: 1, padding: "12px 8px", border: "1px solid",
                        borderColor: newExType === t ? "#f0f0f0" : "#333",
                        background: newExType === t ? "#f0f0f0" : "transparent",
                        color: newExType === t ? "#0a0a0a" : "#ccc",
                        fontFamily: "'DM Mono'", fontSize: "12px", borderRadius: "6px", cursor: "pointer",
                        letterSpacing: "1px",
                      }}>
                      {t === "compound" ? "COMPUESTO (90s)" : "AISLAMIENTO (60s)"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={addExercise} style={{ ...actionBtn, flex: 1, background: "#f0f0f0", color: "#0a0a0a" }}>AGREGAR</button>
                  <button onClick={() => setShowAddExercise(false)} style={{ ...actionBtn, padding: "12px 16px", border: "1px solid #333", color: "#ccc" }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddExercise(true)}
                style={{ background: "transparent", border: "1px dashed #1e1e1e", color: "#888", borderRadius: "8px", padding: "16px", width: "100%", marginBottom: "10px", fontFamily: "'DM Mono'", fontSize: "14px", letterSpacing: "1px", cursor: "pointer" }}>
                + AGREGAR EJERCICIO
              </button>
            )}

            <button
              onClick={sessionTimer.running ? sessionTimer.stopSession : sessionTimer.startSession}
              style={{
                ...actionBtn, width: "100%", marginBottom: "10px",
                border: `1px solid ${sessionTimer.running ? "#7f1d1d" : "#222"}`,
                background: sessionTimer.running ? "#1a0a0a" : "#1a1a1a",
                color: sessionTimer.running ? "#fca5a5" : "#ccc",
                padding: "16px",
              }}>
              {sessionTimer.running ? `■ FINALIZAR SESIÓN · ${sessionTimer.formatted}` : "▶ INICIAR SESIÓN"}
            </button>
          </>
        ) : view === "report" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "13px", color: "#ccc", letterSpacing: "1px" }}>INFORME</span>
              <button onClick={copyReport}
                style={{ ...actionBtn, background: copied ? "#22c55e" : "#f0f0f0", color: "#0a0a0a", minHeight: "44px", padding: "0 22px" }}>
                {copied ? "✓ COPIADO" : "COPIAR"}
              </button>
            </div>
            <pre style={{
              background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "8px",
              padding: "16px", fontSize: "13px", color: "#ccc", whiteSpace: "pre-wrap",
              lineHeight: "1.7", overflowX: "auto",
            }}>
              {reportText}
            </pre>
          </div>
        ) : (
          <ObjetivosTab
            session={session}
            targets={targets}
            activeDay={activeDay}
            weekKey={getWeekKey()}
            onTargetChange={handleTargetChange}
            onTargetRemove={handleTargetRemove}
            onTargetsMerge={handleTargetsMerge}
          />
        )}
      </div>

      {/* Barra de estado. Con la sesión sin arrancar explica la escala — es el
          onboarding de las escalas RIR/fatiga. Apenas hay una serie registrada
          la escala ya se aprendió, y el espacio pasa al estado real de la sesión. */}
      {view === "session" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: Z.statusBar,
          padding: "10px 18px calc(10px + env(safe-area-inset-bottom, 0px))",
          background: "#0a0a0a", borderTop: "1px solid #1a1a1a",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: "12px", flexWrap: "wrap",
        }}>
          {stats.doneSets === 0 ? (
            <span style={{ fontSize: "12px", color: "#888", letterSpacing: "0.5px" }}>
              RIR 0=FALLO · 4+=FÁCIL &nbsp;·&nbsp; FATIGA 1=FRESCO · 5=LÍMITE
            </span>
          ) : (
            <>
              <span style={{ fontSize: "12px", color: "#888", letterSpacing: "0.5px" }}>
                {stats.doneSets}/{stats.totalSets} series · {stats.totalVol.toLocaleString()}kg
              </span>
              <span style={{
                fontSize: "12px", letterSpacing: "0.5px",
                color: stats.pct === 100 ? "#22c55e" : "#888",
              }}>
                {stats.pct === 100 ? "✓ COMPLETO" : `${stats.pct}%`}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputBase = {
  background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#ccc",
  padding: "12px 14px", borderRadius: "8px", fontFamily: "'DM Mono'",
  fontSize: "14px", outline: "none",
};

const actionBtn = {
  border: "none", borderRadius: "8px", padding: "12px 18px",
  fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px",
  cursor: "pointer", background: "transparent",
};
