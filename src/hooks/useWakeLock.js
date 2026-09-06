import { useEffect, useRef } from "react";

// Mantiene la pantalla encendida mientras la sesión está en curso: entre serie
// y serie el teléfono queda apoyado, y que se bloquee obliga a desbloquearlo
// con las manos ocupadas. El navegador suelta el lock al ir a background, por
// eso se vuelve a pedir al recuperar visibilidad.
export function useWakeLock(active) {
  const lockRef = useRef(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lock.addEventListener("release", () => { lockRef.current = null; });
        lockRef.current = lock;
      } catch {
        // Denegado (batería baja, permisos, navegador sin soporte real):
        // no es crítico, la sesión sigue funcionando igual.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible" && !lockRef.current) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
