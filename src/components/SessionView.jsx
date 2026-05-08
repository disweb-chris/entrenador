import { useState, useEffect, useCallback } from "react";
import { DAYS, DEFAULT_EXERCISES, getTodayDayKey, getDateKey, makeEmptySet } from "../lib/constants";
import { getSession, saveSession, getLastSession, getTargets, getRestPrefs, saveRestPrefs } from "../lib/db";
import { generateReport, getWeekKey } from "../lib/report";
import { useRestTimer, useSessionTimer } from "../hooks/useTimer";
import ExerciseCard from "./ExerciseCard";
import RestTimer from "./RestTimer";

export default function SessionView({ user, profile, onSignOut }) {
  const [activeDay, setActiveDay] = useState(getTodayDayKey());
  const [session, setSession] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("session"); // session | report | targets
  const [reportText, setReportText] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExType, setNewExType] = useState("isolation");
  const [sessionNotes, setSessionNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeDateKey, setActiveDateKey] = useState(dateKey);

  const timer = useRestTimer();
  const sessionTimer = useSessionTimer();
  const dateKey = getDateKey();

  // Load session data
  useEffect(() => {
    loadDay(activeDay);
  }, [activeDay]);

  async function loadDay(dayKey) {
    setLoading(true);
    // Try today's session first, fall back to most recent for this dayKey
    let sess = await getSession(user.uid, dateKey, dayKey);
    if (!sess) sess = await getMostRecentSession(user.uid, dayKey);
    const [last, tgts] = await Promise.all([
      getLastSession(user.uid, dayKey, sess?.dateKey || dateKey),
      getTargets(user.uid, getWeekKey()),
    ]);

    if (sess) {
      setSession(sess);
      setActiveDateKey(sess.dateKey || dateKey);
      setSessionNotes(sess.sessionNotes || "");
    } else {
      // Init from defaults
      const defaults = DEFAULT_EXERCISES[dayKey] || [];
      const exercises = {};
      defaults.forEach(ex => {
        exercises[ex.name] = { type: ex.type, sets: [makeEmptySet()], notes: "", restTime: null };
      });
      const newSess = { exercises, sessionNotes: "" };
      setSession(newSess);
      setSessionNotes("");
    }

    setLastSession(last);
    setTargets(tgts);
    setLoading(false);
  }

  const persist = useCallback(async (newSession) => {
    setSession(newSession);
    await saveSession(user.uid, activeDateKey, activeDay, newSession);
  }, [user.uid, dateKey, activeDay]);

  function updateExercise(name, data) {
    const updated = { ...session, exercises: { ...session.exercises, [name]: data } };
    persist(updated);
  }

  function addExercise() {
    if (!newExName.trim()) return;
    const updated = {
      ...session,
      exercises: {
        ...session.exercises,
        [newExName.trim()]: { type: newExType, sets: [makeEmptySet()], notes: "", restTime: null },
      },
    };
    persist(updated);
    setNewExName("");
    setShowAddExercise(false);
  }

  function handleStartRest(seconds, exName, exType) {
    if (!sessionTimer.running) sessionTimer.startSession();
    timer.start(seconds);
    // Save rest time preference for this exercise
    saveRestPrefs(user.uid, { [exName]: seconds });
  }

  function handleAdjustTimer(delta) {
    timer.start(Math.max(5, timer.remaining + delta));
  }

  // Stats
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
      dateKey,
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
      // Save targets
      import("../lib/db").then(({ saveTargets }) => {
        saveTargets(user.uid, parsed.semana || getWeekKey(), parsed.targets);
        setTargets(parsed.targets);
        setTargetInput("");
        setView("session");
      });
    } catch (e) {
      setTargetError("JSON inválido. Revisá el formato.");
    }
  }

  const dayInfo = DAYS.find(d => d.key === activeDay);

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0",
      fontFamily: "'DM Mono', monospace", fontSize: "13px", paddingBottom: "80px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #222; }
        input, textarea { box-sizing: border-box; }
      `}</style>

      {/* REST TIMER OVERLAY */}
      <RestTimer timer={timer} onSkip={timer.skip} onAdjust={handleAdjustTimer} />

      {/* HEADER */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "26px", letterSpacing: "4px", lineHeight: 1 }}>OVERLOAD</div>
            <div style={{ color: "#bbb", fontSize: "10px", letterSpacing: "2px", marginTop: "2px" }}>
              {profile?.name || user.email} · {new Date().toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "20px", color: stats.totalVol > 0 ? "#f0f0f0" : "#222" }}>
              {stats.totalVol > 0 ? `${stats.totalVol.toLocaleString()}kg` : "—"}
            </div>
            <div style={{ fontSize: "10px", color: sessionTimer.running ? "#22c55e" : "#777", letterSpacing: "1px" }}>
              {sessionTimer.running ? `⏱ ${sessionTimer.formatted}` : "sin iniciar"}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "#bbb", fontSize: "10px", letterSpacing: "1px" }}>PROGRESO</span>
            <span style={{ color: stats.pct === 100 ? "#22c55e" : "#555", fontSize: "10px" }}>
              {stats.doneSets}/{stats.totalSets} · {stats.pct}%
            </span>
          </div>
          <div style={{ height: "2px", background: "#1a1a1a", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "2px",
              background: stats.pct === 100 ? "#22c55e" : "linear-gradient(90deg,#3b82f6,#22c55e)",
              width: `${stats.pct}%`, transition: "width 0.4s",
            }} />
          </div>
        </div>
      </div>

      {/* DAY SELECTOR */}
      <div style={{ padding: "8px 16px", display: "flex", gap: "6px", overflowX: "auto", borderBottom: "1px solid #1a1a1a" }}>
        {DAYS.map(d => (
          <button key={d.key}
            onClick={() => { setActiveDay(d.key); setView("session"); }}
            style={{
              padding: "5px 10px", borderRadius: "4px", border: "1px solid",
              borderColor: activeDay === d.key ? "#f0f0f0" : "#1e1e1e",
              background: activeDay === d.key ? "#f0f0f0" : "transparent",
              color: activeDay === d.key ? "#0a0a0a" : "#555",
              fontFamily: "'DM Mono'", fontSize: "10px", letterSpacing: "1px",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
            {d.label}
          </button>
        ))}
        <button onClick={onSignOut}
          style={{ marginLeft: "auto", padding: "5px 10px", background: "transparent", border: "1px solid #1e1e1e", borderRadius: "4px", color: "#bbb", fontFamily: "'DM Mono'", fontSize: "10px", cursor: "pointer", flexShrink: 0 }}>
          SALIR
        </button>
      </div>

      {/* DAY TITLE + VIEW TABS */}
      <div style={{ padding: "10px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: "16px", letterSpacing: "2px" }}>{dayInfo?.full}</span>
          <span style={{ color: "#bbb", fontSize: "10px", marginLeft: "8px", letterSpacing: "1px" }}>{dayInfo?.focus?.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {["session", "report", "targets"].map(v => (
            <button key={v}
              onClick={() => { if (v === "report") buildReport(); else setView(v); }}
              style={{
                background: "transparent", border: "none", fontFamily: "'DM Mono'",
                fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase",
                cursor: "pointer",
                color: view === v ? "#f0f0f0" : "#444",
                borderBottom: `2px solid ${view === v ? "#f0f0f0" : "transparent"}`,
                paddingBottom: "2px",
              }}>
              {v === "session" ? "HOY" : v === "report" ? "INFORME" : "TARGETS"}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding: "6px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#bbb", letterSpacing: "2px" }}>CARGANDO...</div>
        ) : view === "session" ? (
          <>
            {/* Session notes */}
            <textarea
              placeholder="Notas de la sesión (sueño, energía, contexto general...)"
              value={sessionNotes}
              onChange={e => {
                setSessionNotes(e.target.value);
                persist({ ...session, sessionNotes: e.target.value });
              }}
              rows={1}
              style={{
                width: "100%", marginBottom: "10px", background: "#0f0f0f",
                border: "1px solid #1a1a1a", color: "#ccc", padding: "8px 10px",
                borderRadius: "6px", fontFamily: "'DM Mono'", fontSize: "11px",
                resize: "none", outline: "none",
              }}
            />

            {/* Column headers hint */}
            <div style={{ display: "grid", gridTemplateColumns: "20px 72px 60px 1fr 1fr 20px", gap: "4px", padding: "0 12px 6px", color: "#ccc", fontSize: "9px", letterSpacing: "1px" }}>
              <div></div><div>PESO</div><div>REPS</div><div>RIR</div><div>FATIGA</div><div></div>
            </div>

            {Object.entries(session?.exercises || {}).map(([name, data]) => (
              <ExerciseCard
                key={name}
                name={name}
                type={data.type || "isolation"}
                data={data}
                lastData={lastSession?.exercises?.[name]}
                target={targets?.[name]}
                onUpdate={(updated) => updateExercise(name, updated)}
                onStartRest={handleStartRest}
              />
            ))}

            {/* Add exercise */}
            {showAddExercise ? (
              <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
                <input
                  placeholder="Nombre del ejercicio"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addExercise()}
                  autoFocus
                  style={{ ...inputBase, width: "100%", marginBottom: "8px" }}
                />
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  {["compound", "isolation"].map(t => (
                    <button key={t}
                      onClick={() => setNewExType(t)}
                      style={{
                        flex: 1, padding: "6px", border: "1px solid",
                        borderColor: newExType === t ? "#f0f0f0" : "#777",
                        background: newExType === t ? "#f0f0f0" : "transparent",
                        color: newExType === t ? "#0a0a0a" : "#555",
                        fontFamily: "'DM Mono'", fontSize: "10px", borderRadius: "4px", cursor: "pointer",
                        letterSpacing: "1px",
                      }}>
                      {t === "compound" ? "COMPUESTO (90s)" : "AISLAMIENTO (60s)"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={addExercise} style={{ flex: 1, ...actionBtn, background: "#f0f0f0", color: "#0a0a0a" }}>AGREGAR</button>
                  <button onClick={() => setShowAddExercise(false)} style={{ ...actionBtn, padding: "8px 12px", border: "1px solid #333", color: "#ccc" }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddExercise(true)}
                style={{ background: "transparent", border: "1px dashed #1e1e1e", color: "#bbb", borderRadius: "6px", padding: "10px", width: "100%", marginBottom: "8px", fontFamily: "'DM Mono'", fontSize: "11px", letterSpacing: "1px", cursor: "pointer" }}>
                + AGREGAR EJERCICIO
              </button>
            )}

            {/* Session timer controls */}
            <button
              onClick={sessionTimer.running ? sessionTimer.stopSession : sessionTimer.startSession}
              style={{
                ...actionBtn, width: "100%", marginBottom: "8px",
                border: `1px solid ${sessionTimer.running ? "#7f1d1d" : "#222"}`,
                background: sessionTimer.running ? "#1a0a0a" : "#1a1a1a",
                color: sessionTimer.running ? "#fca5a5" : "#bbb",
              }}>
              {sessionTimer.running ? `■ FINALIZAR SESIÓN · ${sessionTimer.formatted}` : "▶ INICIAR SESIÓN"}
            </button>
          </>
        ) : view === "report" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", color: "#ccc", letterSpacing: "1px" }}>INFORME LISTO PARA COMPARTIR</span>
              <button onClick={copyReport}
                style={{ ...actionBtn, background: copied ? "#22c55e" : "#f0f0f0", color: copied ? "#fff" : "#0a0a0a" }}>
                {copied ? "✓ COPIADO" : "COPIAR"}
              </button>
            </div>
            <pre style={{
              background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "8px",
              padding: "14px", fontSize: "11px", color: "#bbb", whiteSpace: "pre-wrap",
              lineHeight: "1.6", overflowX: "auto",
            }}>
              {reportText}
            </pre>
          </div>
        ) : (
          // TARGETS view
          <div>
            {targets && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#ccc", letterSpacing: "1px", marginBottom: "8px" }}>TARGETS ACTUALES</div>
                {Object.entries(targets).map(([ex, t]) => (
                  <div key={ex} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a1a", fontSize: "11px" }}>
                    <span style={{ color: "#bbb" }}>{ex}</span>
                    <span style={{ color: "#3b82f6" }}>{t.series}×{t.reps}@{t.peso}kg</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#ccc", letterSpacing: "1px", marginBottom: "8px" }}>IMPORTAR TARGETS</div>
            <textarea
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              placeholder={`Pegá el JSON de targets:\n{\n  "semana": "2026-W19",\n  "targets": {\n    "Jalón cerrado V": { "series": 3, "reps": 12, "peso": 90 }\n  }\n}`}
              rows={8}
              style={{ ...inputBase, width: "100%", resize: "vertical", marginBottom: "8px", lineHeight: "1.5" }}
            />
            {targetError && <div style={{ color: "#ef4444", fontSize: "11px", marginBottom: "8px" }}>{targetError}</div>}
            <button onClick={importTargets}
              style={{ ...actionBtn, background: "#f0f0f0", color: "#0a0a0a", width: "100%" }}>
              IMPORTAR
            </button>
          </div>
        )}
      </div>

      {/* LEGEND - fixed bottom */}
      {view === "session" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, padding: "8px 16px",
          background: "#0a0a0a", borderTop: "1px solid #1a1a1a",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "9px", color: "#ccc", letterSpacing: "1px" }}>RIR: 0=FALLO · 1=OBJ · 2=OK · 3=LVN · 4+=FÁC</span>
          <span style={{ fontSize: "9px", color: stats.pct === 100 ? "#22c55e" : "#777", letterSpacing: "1px" }}>
            {stats.pct === 100 ? "✓ COMPLETO" : `FATIGA: 1=FRESCO · 5=LÍMITE`}
          </span>
        </div>
      )}
    </div>
  );
}

const inputBase = {
  background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#ccc",
  padding: "8px 10px", borderRadius: "6px", fontFamily: "'DM Mono'",
  fontSize: "11px", outline: "none",
};

const actionBtn = {
  border: "none", borderRadius: "6px", padding: "8px 14px",
  fontFamily: "'DM Mono'", fontSize: "11px", letterSpacing: "1px",
  cursor: "pointer", background: "transparent",
};
