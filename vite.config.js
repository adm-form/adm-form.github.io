import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PORT 5174, ET CE N'EST PAS UN DÉTAIL : la maquette EDD occupe le 5173. Deux
// applications sur le même port, c'est la première qui gagne et la seconde qui
// « ne démarre pas » sans dire pourquoi.
//
// `host: true` — l'application est faite pour une TABLETTE : elle doit écouter
// sur le réseau local, pas seulement sur la machine de développement.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
  preview: { port: 4174, host: true },
  // Les essais de LOGIQUE tournent en Node (rien à simuler) ; ceux qui MONTENT
  // un écran déclarent `@vitest-environment jsdom` en tête de fichier. Les
  // premiers coûtent quelques millisecondes, les seconds une seconde : mélanger
  // les deux environnements ferait payer le prix fort à toute la suite.
  test: { environment: 'node', include: ['tests/**/*.test.{js,jsx}'] },
});
