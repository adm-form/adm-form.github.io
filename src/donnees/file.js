/*
 * LA FILE D'ATTENTE — C'EST ELLE QUI PROTÈGE LE TRAVAIL.
 *
 * UNE FICHE EST ENREGISTRÉE LOCALEMENT D'ABORD, TOUJOURS, ET ENVOYÉE ENSUITE.
 * Jamais l'inverse. Un hangar, un tunnel de service, une antenne saturée : le
 * réseau manque précisément là où le technicien travaille. Une application qui
 * enverrait directement perdrait la fiche en affichant « échec » — et c'est au
 * trentième point de la journée, sous la pluie, que ça arrive.
 *
 * RIEN N'EST SUPPRIMÉ APRÈS L'ENVOI. Une fiche envoyée reste visible, avec son
 * heure d'envoi : le technicien doit pouvoir vérifier ce qui est parti sans
 * ouvrir le fichier Excel. Le ménage est un geste explicite.
 *
 * INDEXEDDB D'ABORD, `localStorage` EN SECOURS. Sur une application installée,
 * IndexedDB échappe à l'expiration des stockages d'iOS ; mais il LÈVE en
 * navigation privée sur certains navigateurs, et une file d'attente qui lève
 * est une fiche perdue. Le secours n'est pas une élégance, c'est le seul
 * endroit du projet où une donnée saisie peut disparaître.
 */
const NOM_BASE = "fiches-terrain";
const MAGASIN = "fiches";
const CLE_SECOURS = "fiches-terrain:file";

export const EN_ATTENTE = "en_attente";
export const ENVOYEE = "envoyee";
export const ERREUR = "erreur";

let basePromesse = null;
let secours = false;

function ouvrir() {
  if (secours) return Promise.reject(new Error("secours"));
  if (basePromesse) return basePromesse;
  basePromesse = new Promise((resoudre, rejeter) => {
    if (typeof indexedDB === "undefined") {
      rejeter(new Error("IndexedDB absent"));
      return;
    }
    const d = indexedDB.open(NOM_BASE, 1);
    d.onupgradeneeded = () => {
      const base = d.result;
      if (!base.objectStoreNames.contains(MAGASIN)) {
        base.createObjectStore(MAGASIN, { keyPath: "id" });
      }
    };
    d.onsuccess = () => resoudre(d.result);
    d.onerror = () => rejeter(d.error || new Error("IndexedDB refusé"));
    d.onblocked = () => rejeter(new Error("IndexedDB bloqué"));
  }).catch((e) => {
    secours = true;
    basePromesse = null;
    throw e;
  });
  return basePromesse;
}

function transaction(mode, action) {
  return ouvrir().then(
    (base) =>
      new Promise((resoudre, rejeter) => {
        const t = base.transaction(MAGASIN, mode);
        const magasin = t.objectStore(MAGASIN);
        let resultat;
        try {
          resultat = action(magasin);
        } catch (e) {
          rejeter(e);
          return;
        }
        t.oncomplete = () => resoudre(resultat && resultat.result !== undefined ? resultat.result : resultat);
        t.onerror = () => rejeter(t.error);
        t.onabort = () => rejeter(t.error || new Error("transaction interrompue"));
      })
  );
}

// --- Secours : le même magasin, dans `localStorage` --------------------------

function lireSecours() {
  try {
    return JSON.parse(localStorage.getItem(CLE_SECOURS) || "[]");
  } catch {
    return [];
  }
}

function ecrireSecours(liste) {
  try {
    localStorage.setItem(CLE_SECOURS, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}

// --- API --------------------------------------------------------------------

export function nouvelId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ficheNeuve(valeurs) {
  return {
    id: nouvelId(),
    cree_le: new Date().toISOString(),
    valeurs,
    etat: EN_ATTENTE,
    tentatives: 0,
    erreur: "",
    envoye_le: "",
  };
}

export async function ajouter(fiche) {
  try {
    await transaction("readwrite", (m) => m.put(fiche));
    return fiche;
  } catch {
    const liste = lireSecours();
    liste.push(fiche);
    ecrireSecours(liste);
    return fiche;
  }
}

export async function toutes() {
  try {
    const liste = await transaction("readonly", (m) => m.getAll());
    return trier(liste || []);
  } catch {
    return trier(lireSecours());
  }
}

function trier(liste) {
  // Ordre de SAISIE : c'est celui dans lequel les lignes doivent entrer dans
  // le fichier Excel. Un tri par état ferait sortir la journée dans le
  // désordre au premier échec rejoué.
  return [...liste].sort((a, b) => String(a.cree_le).localeCompare(String(b.cree_le)));
}

export async function enAttente() {
  return (await toutes()).filter((f) => f.etat !== ENVOYEE);
}

export async function majFiche(id, champs) {
  try {
    const existante = await transaction("readonly", (m) => m.get(id));
    if (!existante) return null;
    const suite = { ...existante, ...champs };
    await transaction("readwrite", (m) => m.put(suite));
    return suite;
  } catch {
    const liste = lireSecours();
    const i = liste.findIndex((f) => f.id === id);
    if (i < 0) return null;
    liste[i] = { ...liste[i], ...champs };
    ecrireSecours(liste);
    return liste[i];
  }
}

export async function supprimer(id) {
  try {
    await transaction("readwrite", (m) => m.delete(id));
  } catch {
    ecrireSecours(lireSecours().filter((f) => f.id !== id));
  }
}

export async function nettoyerEnvoyees() {
  const liste = await toutes();
  const aJeter = liste.filter((f) => f.etat === ENVOYEE);
  for (const f of aJeter) await supprimer(f.id);
  return aJeter.length;
}

export function enSecours() {
  return secours;
}
