import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./lib/firebase";
import { getUserProfile } from "./lib/db";
import AuthScreen from "./components/AuthScreen";
import SessionView from "./components/SessionView";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await getUserProfile(u.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  if (user === undefined) {
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
