import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./lib/firebase";
import { getUserProfile } from "./lib/db";
import AuthScreen from "./components/AuthScreen";
import SessionView from "./components/SessionView";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(undefined); // undefined = loading

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setProfile(await getUserProfile(u.uid));
        } catch (err) {
          console.error("No se pudo leer el perfil:", err);
          setProfile(null); // sin perfil la sesión abre en el día del calendario
        }
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  // El perfil decide qué sesión abrir (rotación), así que se espera a tenerlo:
  // montar antes mostraría un día y saltaría a otro apenas llegue.
  if (user === undefined || (user && profile === undefined)) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0a", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px",
        letterSpacing: "6px", color: "#1a1a1a",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
        OVERLOAD
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <SessionView
      user={user}
      profile={profile}
      onSignOut={() => signOut(auth)}
    />
  );
}
