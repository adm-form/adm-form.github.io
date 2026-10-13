import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

/*
 * L'ENREGISTREMENT DU SERVICE WORKER — APRÈS LE PREMIER RENDU, ET JAMAIS EN
 * DÉVELOPPEMENT.
 *
 * En développement, un service worker servirait un cache à la place du code
 * qu'on vient de modifier : c'est la classe de bogue « les modifications ne
 * s'appliquent pas », avec en plus un cache qui survit au redémarrage.
 *
 * `import.meta.env.PROD` est remplacé à la construction, donc ce bloc
 * disparaît purement et simplement du paquet de développement.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Un service worker refusé (HTTP en clair, politique du navigateur)
         n'empêche rien : l'application fonctionne, elle ne s'ouvre simplement
         pas hors ligne. Le dire dans la console serait du bruit. */
    });
  });
}
