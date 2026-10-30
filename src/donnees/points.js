/*
 * LE RÉFÉRENTIEL DES POINTS D'ÉCHANTILLONNAGE.
 *
 * Deux couches, et c'est voulu :
 *   - `points_defaut.json`, livré avec l'application, dans l'ordre et à
 *     l'orthographe du professionnel ;
 *   - ce que la tablette a enregistré (écran « Points »), qui PRIME.
 *
 * Le référentiel sert à deux choses : proposer la liste du bon aéroport, et
 * REMPLIR TOUT SEUL la matrice (et la méthode, si elle est déclarée) quand le
 * point en porte une.
 *
 * UN « -CQ » HÉRITE DE SON POINT DE BASE. Un contrôle qualité est prélevé au
 * même endroit que le point qu'il double : sa matrice est donc la même, par
 * construction. Cela évite d'attribuer deux fois la même chose — et évite
 * surtout qu'un « B1-CQ » oublié reste sans matrice alors que « B1 » en a une.
 */
import livres from "./points_defaut.json";
import { MATRICES } from "../fiche/schema.js";

const CLE = "fiches-terrain:points";
const METHODES = ["Perche", "Pompe péristaltique", "Manuelle", "Système", "Inspection visuelle seulement"];

export const AUTRE = "Autre";

function nettoyer(entrees) {
  if (!Array.isArray(entrees)) return [];
  return entrees
    .filter((p) => p && typeof p.id === "string" && p.id.trim())
    .map((p) => ({
      id: p.id.trim(),
      matrice: typeof p.matrice === "string" ? p.matrice : "",
      methode: typeof p.methode === "string" ? p.methode : "",
    }));
}

export function pointsLivres() {
  const sortie = {};
  for (const aeroport of ["YUL", "YMX"]) sortie[aeroport] = nettoyer(livres[aeroport]);
  return sortie;
}

export function lire() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return pointsLivres();
    const garde = JSON.parse(brut);
    const sortie = pointsLivres();
    for (const aeroport of Object.keys(sortie)) {
      if (Array.isArray(garde?.[aeroport])) sortie[aeroport] = nettoyer(garde[aeroport]);
    }
    return sortie;
  } catch {
    // Navigation privée, stockage bloqué, contenu abîmé : on retombe sur la
    // liste livrée plutôt que de laisser l'écran sans points.
    return pointsLivres();
  }
}

export function ecrire(points) {
  try {
    localStorage.setItem(CLE, JSON.stringify(points));
    return true;
  } catch {
    return false;
  }
}

export function oublier() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire : on retombe sur la liste livrée */
  }
}

export function pointsDe(points, aeroport) {
  return points?.[aeroport] || [];
}

export function baseDuCQ(id) {
  const m = /^(.+?)[\s-]*CQ$/i.exec(String(id || "").trim());
  if (!m) return null;
  const base = m[1].replace(/[\s-]+$/, "");
  return base || null;
}

export function trouver(points, aeroport, id) {
  const liste = pointsDe(points, aeroport);
  const cible = String(id || "").trim();
  const direct = liste.find((p) => p.id === cible);
  if (direct && (direct.matrice || direct.methode)) return direct;

  const base = baseDuCQ(cible);
  if (base) {
    const parent = liste.find((p) => p.id === base);
    if (parent && (parent.matrice || parent.methode)) {
      return { ...parent, id: cible, herite_de: parent.id };
    }
  }
  return direct || null;
}

/* Ce que le point donne à la fiche. Rien d'autre que les champs déclarés. */
export function valeursDuPoint(points, aeroport, id) {
  const p = trouver(points, aeroport, id);
  if (!p) return null;
  const valeurs = {};
  if (p.matrice) valeurs.matrice = p.matrice;
  if (p.methode) valeurs.methode = p.methode;
  return Object.keys(valeurs).length ? valeurs : null;
}

export function modifier(points, aeroport, id, champs) {
  const liste = pointsDe(points, aeroport);
  const suite = liste.map((p) => (p.id === id ? { ...p, ...champs } : p));
  return { ...points, [aeroport]: suite };
}

export function ajouter(points, aeroport, point) {
  const liste = pointsDe(points, aeroport);
  const id = String(point.id || "").trim();
  if (!id || liste.some((p) => p.id === id)) return points;
  return { ...points, [aeroport]: [...liste, { id, matrice: "", methode: "", ...point, id }] };
}

export function supprimer(points, aeroport, id) {
  return { ...points, [aeroport]: pointsDe(points, aeroport).filter((p) => p.id !== id) };
}

/*
 * L'ATTRIBUTION EN LOT PAR PRÉFIXE.
 *
 * Quatre-vingt-huit points à qualifier un par un, c'est quatre-vingt-huit
 * occasions de se tromper. « Tous les points qui commencent par RP- sont au
 * pluvial » est une phrase que le professionnel peut vérifier d'un coup d'œil.
 * Les « -CQ » sont laissés DE CÔTÉ : ils héritent, et leur donner une valeur
 * propre créerait deux vérités pour le même ouvrage.
 */
export function parPrefixe(points, aeroport, prefixe, champs) {
  const debut = String(prefixe || "").trim().toLowerCase();
  if (!debut) return points;
  const suite = pointsDe(points, aeroport).map((p) => {
    if (baseDuCQ(p.id)) return p;
    return p.id.toLowerCase().startsWith(debut) ? { ...p, ...champs } : p;
  });
  return { ...points, [aeroport]: suite };
}

export function comptePrefixe(points, aeroport, prefixe) {
  const debut = String(prefixe || "").trim().toLowerCase();
  if (!debut) return 0;
  return pointsDe(points, aeroport).filter(
    (p) => !baseDuCQ(p.id) && p.id.toLowerCase().startsWith(debut)
  ).length;
}

/*
 * COLLER UNE LISTE. Une colonne d'Excel, ou trois : « point », « matrice »,
 * « méthode », séparées par une tabulation ou un point-virgule.
 *
 * On ne devine PAS la matrice d'après le nom du point : une valeur non
 * reconnue est signalée ligne par ligne plutôt que rangée au hasard dans une
 * des quatre matrices. Un référentiel faux a l'air d'un référentiel.
 */
export function analyserListe(texte) {
  const points = [];
  const refus = [];
  const lignes = String(texte || "").split(/\r?\n/);
  lignes.forEach((ligne, i) => {
    const brut = ligne.trim();
    if (!brut) return;
    const cases = brut.split(/\t|;/).map((c) => c.trim());
    const id = cases[0];
    if (!id) return;
    const point = { id, matrice: "", methode: "" };
    for (const valeur of cases.slice(1)) {
      if (!valeur) continue;
      const matrice = MATRICES.find((m) => m.toLowerCase() === valeur.toLowerCase());
      const methode = METHODES.find((m) => m.toLowerCase() === valeur.toLowerCase());
      if (matrice) point.matrice = matrice;
      else if (methode) point.methode = methode;
      else refus.push({ ligne: i + 1, valeur, id });
    }
    points.push(point);
  });
  return { points, refus };
}

export function fusionner(points, aeroport, nouveaux) {
  const liste = [...pointsDe(points, aeroport)];
  let ajoutes = 0;
  let majs = 0;
  for (const neuf of nouveaux) {
    const i = liste.findIndex((p) => p.id === neuf.id);
    if (i < 0) {
      liste.push(neuf);
      ajoutes++;
    } else {
      // On ne VIDE jamais une valeur existante avec une case vide du
      // collage : un fichier collé sans la colonne matrice effacerait tout le
      // travail d'attribution.
      const fondu = { ...liste[i] };
      if (neuf.matrice) fondu.matrice = neuf.matrice;
      if (neuf.methode) fondu.methode = neuf.methode;
      if (fondu.matrice !== liste[i].matrice || fondu.methode !== liste[i].methode) majs++;
      liste[i] = fondu;
    }
  }
  return { points: { ...points, [aeroport]: liste }, ajoutes, majs };
}

export function sansMatrice(points, aeroport) {
  return pointsDe(points, aeroport).filter((p) => !p.matrice && !baseDuCQ(p.id));
}
