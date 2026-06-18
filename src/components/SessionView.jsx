import { useState, useEffect, useCallback } from "react";
import { DAYS, DEFAULT_EXERCISES, getDateKey, makeEmptySet } from "../lib/constants";
import { saveSession, getSessionForDay, getLastSession, getTargets, saveRestPrefs, saveTargets } from "../lib/db";
import { generateReport, getWeekKey } from "../lib/report";
import { useRestTimer, useSessionTimer } from "../hooks/useTimer";
import ExerciseCard from "./ExerciseCard";
import RestTimer from "./RestTimer";

export default function SessionView({ user, profile, onSignOut }) {
  const dateKey = getDateKey();

  const [activeDay, setActiveDay] = useState(null);
  const [activeDateKey, setActiveDateKey] = useState(dateKey);
  const [session, setSession] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("session");
  const [reportText, setReportText] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExType, setNewExType] = useState("isolation");
  const [sessionNotes, setSessionNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const timer = useRestTimer();
  const sessionTimer = useSessionTimer();

  useEffect(() => {
    if (!activeDay) { setLoading(false); return; }
    loadDay(activeDay);
  }, [activeDay]);

  async function loadDay(dayKey) {
    setLoading(true);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const [sess, tgts, nextTgts] = await Promise.all([
      getSessionForDay(user.uid, dateKey, dayKey),
      getTargets(user.uid, getWeekKey()),
      getTargets(user.uid, getWeekKey(nextWeek)),
    ]);
    const last = await getLastSession(user.uid, dayKey, sess?.dateKey || dateKey);

    if (sess) {
      setSession(sess);
      setActiveDateKey(sess.dateKey || dateKey);
      setSessionNotes(sess.sessionNotes || "");
    } else {
      const defaults = DEFAULT_EXERCISES[dayKey] || [];
      const exercises = {};
      defaults.forEach(ex => {
        exercises[ex.name] = { type: ex.type, sets: [makeEmptySet()], notes: "", restTime: null };
      });
      setSession({ exercises, sessionNotes: "" });
      setActiveDateKey(dateKey);
      setSessionNotes("");
    }

    setLastSession(last);
    setTargets({ ...(tgts || {}), ...(nextTgts || {}) });
    setLoading(false);
  }

  const persist = useCallback(async (newSession) => {
    setSession(newSession);
    await saveSession(user.uid, activeDateKey, activeDay, newSession);
  }, [user.uid, activeDateKey, activeDay]);

  function updateExercise(name, data) {
    persist({ ...session, exercises: { ...session.exercises, [name]: data } });
  }

  function deleteExercise(name) {
    const { [name]: _, ...rest } = session.exercises;
    persist({ ...session, exercises: rest });
  }

  function addExercise() {
    if (!newExName.trim()) return;
    persist({
      ...session,
      exercises: {
        ...session.exercises,
        [newExName.trim()]: { type: newExType, sets: [makeEmptySet()], notes: "", restTime: null },
      },
    });
    setNewExName("");
    setShowAddExercise(false);
  }

  function handleStartRest(seconds, exName) {
    if (!sessionTimer.running) sessionTimer.startSession();
    timer.start(seconds);
    saveRestPrefs(user.uid, { [exName]: seconds });
  }

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

  function buildReport() {
    if (!session) return;
    const text = generateReport({
      session,
      lastSession,
      dayKey: activeDay,
      dateKey: activeDateKey,
      sessionDuration: sessionTimer.formatted,
      userName: profile?.name || user.email,
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

  function importTargets() {
    setTargetError("");
    try {
      const parsed = JSON.parse(targetInput);
      if (!parsed.targets) throw new Error("Formato inválido");
      saveTargets(user.uid, parsed.semana || getWeekKey(), parsed.targets);
      setTargets(prev => ({ ...(prev || {}), ...parsed.targets }));
      setTargetInput("");
      setView("session");
    } catch (e) {
      setTargetError("JSON inválido. Revisá el formato.");
    }
  }

  const dayInfo = DAYS.find(d => d.key === activeDay);

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
      `}</style>

      <RestTimer timer={timer} onSkip={timer.skip} onAdjust={handleAdjustTimer} />

      {/* HEADER */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "38px", letterSpacing: "5px", lineHeight: 1 }}>OVERLOAD</div>
            <div style={{ color: "#888", fontSize: "13px", letterSpacing: "1px", marginTop: "4px" }}>
              {profile?.name || user.email} · {activeDateKey}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "28px", color: stats.totalVol > 0 ? "#f0f0f0" : "#444" }}>
              {stats.totalVol > 0 ? `${stats.totalVol.toLocaleString()}kg` : "—"}
            </div>
            <div style={{ fontSize: "13px", color: sessionTimer.running ? "#22c55e" : "#888", letterSpacing: "0.5px" }}>
              {sessionTimer.running ? `⏱ ${sessionTimer.formatted}` : "sin iniciar"}
            </div>
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
      <div style={{ padding: "10px 18px", display: "flex", gap: "8px", overflowX: "auto", borderBottom: "1px solid #1a1a1a" }}>
        {DAYS.map(d => (
          <button key={d.key}
            onClick={() => { setActiveDay(d.key); setView("session"); }}
            style={{
              padding: "10px 18px", borderRadius: "6px", border: "1px solid",
              borderColor: activeDay === d.key ? "#f0f0f0" : "#1e1e1e",
              background: activeDay === d.key ? "#f0f0f0" : "transparent",
              color: activeDay === d.key ? "#0a0a0a" : "#ccc",
              fontFamily: "'DM Mono'", fontSize: "13px", letterSpacing: "1px",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
            {d.label}
          </button>
        ))}
        <button onClick={onSignOut}
          style={{ marginLeft: "auto", padding: "10px 18px", background: "transparent", border: "1px solid #1e1e1e", borderRadius: "6px", color: "#888", fontFamily: "'DM Mono'", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>
          SALIR
        </button>
      </div>

      {/* DAY TITLE + TABS */}
      <div style={{ padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: "22px", letterSpacing: "2px" }}>{dayInfo?.full}</span>
          <span style={{ color: "#888", fontSize: "13px", marginLeft: "10px", letterSpacing: "1px" }}>{dayInfo?.focus?.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          {["session", "report", "targets"].map(v => (
            <button key={v}
              onClick={() => { if (v === "report") buildReport(); else setView(v); }}
              style={{
                background: "transparent", border: "none", fontFamily: "'DM Mono'",
                fontSize: "13px", letterSpacing: "1px", textTransform: "uppercase",
                cursor: "pointer",
                color: view === v ? "#f0f0f0" : "#888",
                borderBottom: `2px solid ${view === v ? "#f0f0f0" : "transparent"}`,
                paddingBottom: "3px",
              }}>
              {v === "session" ? "HOY" : v === "report" ? "INFORME" : "OBJETIVOS"}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "8px 18px" }}>
        {!activeDay ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#555", letterSpacing: "2px", fontSize: "14px" }}>
            SELECCIONÁ UN DÍA
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#555", letterSpacing: "3px", fontSize: "14px" }}>CARGANDO...</div>
        ) : view === "session" ? (
          <>
            <textarea
              placeholder="Notas de la sesión (sueño, energía, contexto...)"
              value={sessionNotes}
              onChange={e => {
                setSessionNotes(e.target.value);
                persist({ ...session, sessionNotes: e.target.value });
              }}
              rows={1}
              style={{
                width: "100%", marginBottom: "12px", background: "#0f0f0f",
                border: "1px solid #1a1a1a", color: "#ccc", padding: "12px 14px",
                borderRadius: "8px", fontFamily: "'DM Mono'", fontSize: "14px",
                resize: "none", outline: "none",
              }}
            />

            {Object.entries(session?.exercises || {}).map(([name, data]) => (
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
                style={{ ...actionBtn, background: copied ? "#22c55e" : "#f0f0f0", color: copied ? "#f0f0f0" : "#0a0a0a", padding: "10px 22px" }}>
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
          <div>
            {targets && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", color: "#888", letterSpacing: "2px", marginBottom: "10px" }}>TARGETS ACTUALES</div>
                {Object.entries(targets).map(([ex, t]) => (
                  <div key={ex} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1a1a1a", fontSize: "14px" }}>
                    <span style={{ color: "#ccc" }}>{ex}</span>
                    <span style={{ color: "#60a5fa" }}>{t.series}×{t.reps}@{t.peso}kg</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: "13px", color: "#888", letterSpacing: "2px", marginBottom: "10px" }}>IMPORTAR TARGETS</div>
            <textarea
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              placeholder={'Pegá el JSON de targets:\n{\n  "semana": "2026-W24",\n  "targets": {\n    "Jalón cerrado V": { "series": 3, "reps": 12, "peso": 90 }\n  }\n}'}
              rows={8}
              style={{ ...inputBase, width: "100%", resize: "vertical", marginBottom: "10px", lineHeight: "1.5" }}
            />
            {targetError && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "10px" }}>{targetError}</div>}
            <button onClick={importTargets}
              style={{ ...actionBtn, background: "#f0f0f0", color: "#0a0a0a", width: "100%", padding: "16px" }}>
              IMPORTAR
            </button>
          </div>
        )}
      </div>

      {view === "session" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 18px",
          background: "#0a0a0a", borderTop: "1px solid #1a1a1a",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "12px", color: "#555", letterSpacing: "0.5px" }}>RIR: 0=FALLO · 1=OBJ · 2=OK · 3=LEVE · 4+=FÁCIL</span>
          <span style={{ fontSize: "12px", color: stats.pct === 100 ? "#22c55e" : "#555", letterSpacing: "0.5px" }}>
            {stats.pct === 100 ? "✓ COMPLETO" : "FAT: 1=FRESCO · 5=LÍMITE"}
          </span>
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
