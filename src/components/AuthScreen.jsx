import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { setUserProfile } from "../lib/db";

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) { setError("Ingresá tu nombre"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setUserProfile(cred.user.uid, { name: name.trim(), email, createdAt: Date.now() });
      }
    } catch (e) {
      const msgs = {
        "auth/invalid-credential": "Email o contraseña incorrectos",
        "auth/email-already-in-use": "El email ya está registrado",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
        "auth/invalid-email": "Email inválido",
      };
      setError(msgs[e.code] || e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "20px",
      fontFamily: "'DM Mono', monospace",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: "48px", letterSpacing: "6px", color: "#f0f0f0", lineHeight: 1 }}>
            OVERLOAD
          </div>
          <div style={{ color: "#888", fontSize: "11px", letterSpacing: "3px", marginTop: "6px" }}>
            PROGRESSIVE OVERLOAD TRACKER
          </div>
        </div>

        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "24px" }}>
          <div style={{ display: "flex", marginBottom: "20px", background: "#0a0a0a", borderRadius: "6px", padding: "3px" }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "8px", border: "none", borderRadius: "4px",
                  background: mode === m ? "#f0f0f0" : "transparent",
                  color: mode === m ? "#0a0a0a" : "#555",
                  fontFamily: "'DM Mono'", fontSize: "11px", letterSpacing: "1px",
                  cursor: "pointer", textTransform: "uppercase",
                }}>
                {m === "login" ? "Ingresar" : "Registrarse"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <input
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ ...inputStyle, marginBottom: "0" }}
          />

          {error && (
            <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "10px", letterSpacing: "0.5px" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", marginTop: "16px", padding: "12px",
              background: loading ? "#222" : "#f0f0f0",
              color: loading ? "#555" : "#0a0a0a",
              border: "none", borderRadius: "6px",
              fontFamily: "'DM Mono'", fontSize: "12px", letterSpacing: "2px",
              cursor: loading ? "not-allowed" : "pointer", textTransform: "uppercase",
            }}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", marginBottom: "10px", padding: "10px 12px",
  background: "#0f0f0f", border: "1px solid #222", borderRadius: "6px",
  color: "#f0f0f0", fontFamily: "'DM Mono'", fontSize: "13px", outline: "none",
  display: "block",
};
