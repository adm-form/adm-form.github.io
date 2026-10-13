/*
 * LES ICÔNES DE L'APPLICATION INSTALLÉE — produites par ce script.
 *
 * GÉNÉRÉES DONC REMPLAÇABLES : poser ses propres PNG par-dessus suffit, rien
 * n'en dépend. Lancer `npm run icones` pour les refaire.
 *
 * Aucune dépendance : le PNG est écrit à la main (en-tête, scanlines, zlib),
 * et les formes sont rasterisées par un test « ce pixel est-il dedans ? » avec
 * suréchantillonnage 3x3 pour l'anticrénelage. Installer une bibliothèque
 * d'images pour trois carrés et une goutte serait un mauvais marché.
 *
 * DEUX FAMILLES D'ICÔNES, ET LA DIFFÉRENCE COMPTE :
 *   - `icone-192` / `icone-512` : le dessin occupe tout le carré. iOS arrondit
 *     lui-même les coins de l'icône d'accueil ; un PNG déjà arrondi sur fond
 *     transparent y laisserait des coins noirs.
 *   - `icone-maskable-512` : Android recadre librement dans un cercle ou un
 *     carré arrondi. Le dessin doit donc tenir dans les 80 % du centre (la
 *     « zone sûre »), sinon la goutte est rognée.
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "public");

const FOND = [15, 118, 110]; // teal-700 — la couleur de thème de l'application
const EAU = [255, 255, 255];
const OMBRE = [13, 148, 136]; // teal-600, pour que la goutte ne soit pas plate

// --- PNG ---------------------------------------------------------------------

const TABLE_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloc(type, donnees) {
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const empreinte = Buffer.alloc(4);
  empreinte.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, empreinte]);
}

function ecrirePng(chemin, largeur, hauteur, pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 6; // RVBA
  const lignes = Buffer.alloc(hauteur * (1 + largeur * 4));
  for (let y = 0; y < hauteur; y++) {
    const depart = y * (1 + largeur * 4);
    lignes[depart] = 0; // filtre « aucun »
    pixels.copy(lignes, depart + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  writeFileSync(
    chemin,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      bloc("IHDR", entete),
      bloc("IDAT", zlib.deflateSync(lignes, { level: 9 })),
      bloc("IEND", Buffer.alloc(0)),
    ])
  );
}

// --- Dessin ------------------------------------------------------------------

// Une goutte : un disque, surmonté d'un cône qui s'affine jusqu'à la pointe.
// Le cône est linéaire plutôt que tangent au disque — à cette taille, l'œil ne
// fait pas la différence et le calcul reste lisible.
function dansLaGoutte(x, y, cx, cyDisque, rayon, yPointe) {
  const dx = x - cx;
  if (Math.hypot(dx, y - cyDisque) <= rayon) return true;
  if (y < yPointe || y > cyDisque) return false;
  const demiLargeur = (rayon * (y - yPointe)) / (cyDisque - yPointe);
  return Math.abs(dx) <= demiLargeur;
}

function dansLeCoinArrondi(x, y, cote, rayon) {
  const px = Math.min(x, cote - x);
  const py = Math.min(y, cote - y);
  if (px >= rayon || py >= rayon) return true;
  return Math.hypot(rayon - px, rayon - py) <= rayon;
}

function faireIcone(cote, { arrondi = 0, echelle = 1 } = {}) {
  const pixels = Buffer.alloc(cote * cote * 4);
  const cx = cote / 2;
  const rayon = 0.26 * cote * echelle;
  const cyDisque = cote / 2 + 0.09 * cote * echelle;
  const yPointe = cyDisque - 0.46 * cote * echelle;
  const rayonCoin = arrondi * cote;
  const SUR = 3; // suréchantillonnage : 3x3 sous-pixels

  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      let dedansFond = 0;
      let dedansEau = 0;
      for (let sy = 0; sy < SUR; sy++) {
        for (let sx = 0; sx < SUR; sx++) {
          const px = x + (sx + 0.5) / SUR;
          const py = y + (sy + 0.5) / SUR;
          if (rayonCoin > 0 && !dansLeCoinArrondi(px, py, cote, rayonCoin)) continue;
          dedansFond++;
          if (dansLaGoutte(px, py, cx, cyDisque, rayon, yPointe)) dedansEau++;
        }
      }
      const total = SUR * SUR;
      const alpha = Math.round((255 * dedansFond) / total);
      const partEau = dedansFond ? dedansEau / dedansFond : 0;
      // Un léger dégradé sur la goutte, pour qu'elle ne soit pas un aplat.
      const reflet = Math.max(0, Math.min(1, (y - yPointe) / (cyDisque - yPointe) - 0.35));
      const eau = EAU.map((c, i) => c * (1 - reflet * 0.18) + OMBRE[i] * reflet * 0.18);
      const i = (y * cote + x) * 4;
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(FOND[c] * (1 - partEau) + eau[c] * partEau);
      }
      pixels[i + 3] = alpha;
    }
  }
  return pixels;
}

mkdirSync(SORTIE, { recursive: true });

const aProduire = [
  // Plein cadre : iOS et le manifeste arrondissent eux-mêmes.
  ["icone-192.png", 192, { arrondi: 0, echelle: 1 }],
  ["icone-512.png", 512, { arrondi: 0, echelle: 1 }],
  // Maskable : le dessin se replie dans la zone sûre des 80 % du centre.
  ["icone-maskable-512.png", 512, { arrondi: 0, echelle: 0.76 }],
  // Le favicon, lui, s'affiche tel quel dans un onglet : coins arrondis.
  ["favicon.png", 64, { arrondi: 0.2, echelle: 1 }],
];

for (const [nom, cote, options] of aProduire) {
  ecrirePng(join(SORTIE, nom), cote, cote, faireIcone(cote, options));
  console.log(`${nom} — ${cote}x${cote}`);
}
