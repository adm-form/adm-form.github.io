import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOM DU DÉPÔT = CHEMIN DE BASE SUR GITHUB PAGES.
// L'application est servie sous https://<compte>.github.io/Fiches-terrain-ADM/ :
// tout chemin absolu (« /sw.js », « /icone-192.png ») pointerait à côté. La
// casse compte. Si le dépôt est renommé, ce nom est la seule ligne à changer.
// `VITE_BASE=/` permet une construction à la racine (autre hébergeur, essais).
const BASE = process.env.VITE_BASE || '/Fiches-terrain-ADM/';

// PORT 5174, ET CE N'EST PAS UN DÉTAIL : la maquette EDD occupe le 5173. Deux
// applications sur le même port, c'est la première qui gagne et la seconde qui
// « ne démarre pas » sans dire pourquoi.
//
// `host: true` — l'application est faite pour une TABLETTE : elle doit écouter
// sur le réseau local, pas seulement sur la machine de développement.
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // PRÉCACHE COMPLET : le plugin liste lui-même tous les fichiers produits
    // (avec leur empreinte) et le service worker les garde. Plus de liste
    // écrite à la main, donc plus de liste qui devient fausse. La navigation
    // retombe sur index.html hors ligne (application d'une seule page).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icone-192.png', 'icone-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // exceljs est lourd (~1 Mo) : il reste précaché, sinon l'export .xlsx
        // ne marcherait pas hors ligne.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Fiches Terrain — échantillonnage des eaux YUL / YMX',
        short_name: 'Fiches Terrain',
        description:
          "Fiche d'échantillonnage d'eau remplie sur la tablette, puis versée dans le fichier Excel du SharePoint.",
        lang: 'fr-CA',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        id: BASE,
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        orientation: 'any',
        background_color: '#F3F4F6',
        theme_color: '#0F766E',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5174, host: true },
  preview: { port: 4174, host: true },
  // Les essais de LOGIQUE tournent en Node (rien à simuler) ; ceux qui MONTENT
  // un écran déclarent `@vitest-environment jsdom` en tête de fichier. Les
  // premiers coûtent quelques millisecondes, les seconds une seconde : mélanger
  // les deux environnements ferait payer le prix fort à toute la suite.
  test: { environment: 'node', include: ['tests/**/*.test.{js,jsx}'] },
});
