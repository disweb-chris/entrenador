import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// El service worker se instala con skipWaiting + clientsClaim, así que un deploy
// nuevo toma control apenas termina de precachearse. Pero la página que ya está
// renderizada sigue mostrando el bundle viejo: sin esto, cada deploy se ve recién
// en la segunda apertura de la app. El cambio de controlador ocurre a los pocos
// segundos de abrir, no a mitad de una sesión.
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Sin controlador previo es la primera instalación, no una actualización:
    // recargar ahí sería un refresh gratuito en la primera visita.
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
