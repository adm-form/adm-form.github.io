import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

/*
 * LE SERVICE WORKER EST GÉRÉ PAR vite-plugin-pwa (voir vite.config.js) : il
 * produit le fichier, le précache de tous les fichiers de l'application et
 * l'enregistrement, en production seulement. En développement il ne tourne
 * pas — un cache servirait l'ancien code à la place de celui qu'on modifie.
 * Mise à jour : à l'ouverture suivante en ligne, la nouvelle version s'installe
 * et prend la main toute seule (registerType: autoUpdate).
 */
