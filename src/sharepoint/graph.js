/*
 * MICROSOFT GRAPH — LE STRICT NÉCESSAIRE POUR AJOUTER UNE LIGNE À UN TABLEAU
 * EXCEL QUI VIT SUR UN SHAREPOINT.
 *
 * ON N'OUVRE PAS LE FICHIER, ON NE LE TÉLÉCHARGE PAS, ON NE LE RÉÉCRIT PAS.
 * Graph expose le classeur comme une API : `tables/{t}/rows/add` ajoute une
 * ligne, et c'est tout. Télécharger le .xlsx, le modifier et le renvoyer
 * écraserait le travail de quiconque l'a ouvert entre-temps — et au bureau,
 * ce fichier est ouvert par quelqu'un presque tout le temps.
 *
 * ON DÉSIGNE LES FEUILLES ET LES TABLEAUX PAR LEUR IDENTIFIANT, PAS PAR LEUR
 * NOM. `worksheets('Données 2026')` demande d'échapper les espaces, les
 * accents et surtout les apostrophes (qui se doublent) ; l'identifiant est
 * opaque et traverse une URL sans rien casser. Le nom ne sert qu'à l'écran.
 *
 * LES ERREURS SONT NOMMÉES, PARCE QU'ELLES APPELLENT DES GESTES OPPOSÉS :
 * se reconnecter, demander un droit, corriger le lien, ou simplement
 * ATTENDRE. Une erreur unique « échec de l'envoi » ferait ressaisir une fiche
 * qui n'avait besoin que de réseau.
 */
const RACINE = "https://graph.microsoft.com/v1.0";

export class ErreurGraph extends Error {
  constructor(message, { genre, statut = 0, detail = "", apres = 0 } = {}) {
    super(message);
    this.name = "ErreurGraph";
    this.genre = genre;
    this.statut = statut;
    this.detail = detail;
    this.apres = apres; // secondes à attendre, quand le serveur le dit
  }
}

/* Ce qui vaut la peine d'être rejoué tel quel, et ce qui ne le vaut pas. Un
 * 403 rejoué reste un 403 ; une coupure de réseau, non. */
const REESSAYABLES = new Set(["hors_ligne", "occupe", "trop_vite", "serveur"]);
export const reessayable = (genre) => REESSAYABLES.has(genre);

export function genreDeStatut(statut) {
  if (statut === 401) return "connexion";
  if (statut === 403) return "droits";
  if (statut === 404) return "introuvable";
  if (statut === 409 || statut === 423) return "occupe";
  if (statut === 429) return "trop_vite";
  if (statut >= 500) return "serveur";
  return "refus";
}

export const MESSAGES = {
  hors_ligne: "Pas de réseau. La fiche reste dans la file d'attente et partira au retour du signal.",
  connexion: "La session Microsoft a expiré. Se reconnecter dans Réglages.",
  droits: "Ce compte n'a pas le droit d'écrire dans ce fichier.",
  introuvable: "Fichier ou tableau introuvable. Vérifier le lien dans Réglages.",
  occupe: "Le classeur est momentanément verrouillé. Nouvel essai possible.",
  trop_vite: "Microsoft demande de ralentir. Nouvel essai dans un moment.",
  serveur: "Microsoft 365 a renvoyé une erreur temporaire.",
  refus: "Microsoft a refusé la demande.",
};

async function appeler(jeton, chemin, { methode = "GET", corps = null } = {}) {
  let reponse;
  try {
    reponse = await fetch(`${RACINE}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch (e) {
    // `fetch` ne lève que pour le réseau : DNS, coupure, CORS. Tout le reste
    // arrive avec un code HTTP.
    throw new ErreurGraph(MESSAGES.hors_ligne, { genre: "hors_ligne", detail: String(e) });
  }

  if (reponse.status === 204) return null;

  const texte = await reponse.text();
  let donnees = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    donnees = null;
  }

  if (!reponse.ok) {
    const genre = genreDeStatut(reponse.status);
    const detail = donnees?.error?.message || texte.slice(0, 500);
    const apres = Number(reponse.headers.get("Retry-After") || 0);
    throw new ErreurGraph(MESSAGES[genre], { genre, statut: reponse.status, detail, apres });
  }
  return donnees;
}

/*
 * UN LIEN DE PARTAGE SE CONVERTIT EN IDENTIFIANT DE FICHIER.
 *
 * Graph accepte l'URL telle qu'on la copie depuis SharePoint, à condition de
 * l'encoder en base64 « sûre pour une URL » et de la préfixer de `u!`. C'est
 * documenté et stable ; c'est aussi la seule façon de partir de ce que
 * l'utilisateur peut VRAIMENT produire : le bouton « Copier le lien ».
 */
export function encoderLien(lien) {
  const octets = new TextEncoder().encode(String(lien).trim());
  let brut = "";
  for (const o of octets) brut += String.fromCharCode(o);
  const b64 = btoa(brut);
  return `u!${b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-")}`;
}

export async function resoudreFichier(jeton, lien) {
  const donnees = await appeler(
    jeton,
    `/shares/${encoderLien(lien)}/driveItem?$select=id,name,webUrl,parentReference,file`
  );
  const driveId = donnees?.parentReference?.driveId;
  if (!driveId || !donnees?.id) {
    throw new ErreurGraph("Ce lien ne désigne pas un fichier accessible.", {
      genre: "refus",
      detail: JSON.stringify(donnees || {}).slice(0, 300),
    });
  }
  const nom = donnees.name || "";
  if (!/\.xlsx?$/i.test(nom) && !/\.xlsm$/i.test(nom)) {
    throw new ErreurGraph(`« ${nom} » n'est pas un classeur Excel.`, { genre: "refus" });
  }
  return { driveId, itemId: donnees.id, nomFichier: nom, webUrl: donnees.webUrl || "" };
}

const classeur = ({ driveId, itemId }) => `/drives/${driveId}/items/${itemId}/workbook`;

export async function feuilles(jeton, f) {
  const d = await appeler(jeton, `${classeur(f)}/worksheets?$select=id,name,position`);
  return d?.value || [];
}

export async function tables(jeton, f) {
  const d = await appeler(jeton, `${classeur(f)}/tables?$select=id,name,showHeaders`);
  return d?.value || [];
}

export async function tablesDeLaFeuille(jeton, f, feuilleId) {
  const d = await appeler(
    jeton,
    `${classeur(f)}/worksheets/${encodeURIComponent(feuilleId)}/tables?$select=id,name,showHeaders`
  );
  return d?.value || [];
}

export async function entetes(jeton, f, tableId) {
  const d = await appeler(
    jeton,
    `${classeur(f)}/tables/${encodeURIComponent(tableId)}/headerRowRange?$select=values`
  );
  return (d?.values?.[0] || []).map((v) => (v === null || v === undefined ? "" : String(v)));
}

export async function nombreDeLignes(jeton, f, tableId) {
  const d = await appeler(
    jeton,
    `${classeur(f)}/tables/${encodeURIComponent(tableId)}/dataBodyRange?$select=rowCount`
  );
  return d?.rowCount ?? 0;
}

export async function ajouterLigne(jeton, f, tableId, valeurs) {
  return appeler(jeton, `${classeur(f)}/tables/${encodeURIComponent(tableId)}/rows/add`, {
    methode: "POST",
    // `index: null` — à la FIN du tableau. C'est le seul endroit où une
    // nouvelle observation a un sens : l'ordre des lignes est chronologique.
    corps: { index: null, values: [valeurs] },
  });
}

/* Les valeurs d'une colonne du tableau, par son titre. Sert à vérifier qu'une
 * fiche n'a pas déjà été écrite (voir `envoi.js`). */
export async function valeursDeColonne(jeton, f, tableId, titre) {
  const nom = String(titre).replace(/'/g, "''");
  const d = await appeler(
    jeton,
    `${classeur(f)}/tables/${encodeURIComponent(tableId)}/columns('${encodeURIComponent(nom)}')?$select=values`
  );
  return (d?.values || []).map((r) => (r?.[0] === null || r?.[0] === undefined ? "" : String(r[0])));
}

/* « A », « B »… « AA ». Pour l'adresse de la ligne d'en-tête à écrire. */
export function colonneExcel(index) {
  let n = index + 1;
  let nom = "";
  while (n > 0) {
    const reste = (n - 1) % 26;
    nom = String.fromCharCode(65 + reste) + nom;
    n = Math.floor((n - 1) / 26);
  }
  return nom;
}

export async function plageUtilisee(jeton, f, feuilleId) {
  // `valuesOnly=true` : on veut savoir si la feuille porte des données, pas
  // récupérer sa mise en forme.
  return appeler(
    jeton,
    `${classeur(f)}/worksheets/${encodeURIComponent(feuilleId)}/usedRange(valuesOnly=true)?$select=address,rowCount,columnCount,values`
  );
}

/*
 * CRÉER LE TABLEAU — seulement quand la feuille est VIDE.
 *
 * On refuse d'écrire des en-têtes par-dessus une feuille qui porte déjà
 * quelque chose : ce serait écraser le travail du professionnel pour installer
 * le nôtre. Dans ce cas, l'écran Réglages demande de convertir la plage
 * existante en tableau (dans Excel : Insertion > Tableau), ce qui préserve les
 * colonnes telles qu'elles sont.
 */
export async function creerTable(jeton, f, feuilleId, titres, nomTable = "FichesTerrain") {
  const utilisee = await plageUtilisee(jeton, f, feuilleId);
  const remplie = (utilisee?.values || []).some((ligne) =>
    (ligne || []).some((c) => c !== "" && c !== null && c !== undefined)
  );
  if (remplie) {
    throw new ErreurGraph(
      "Cette feuille contient déjà des données. Créer le tableau dans Excel (Insertion > Tableau) plutôt que d'écraser ce qui s'y trouve.",
      { genre: "refus", detail: utilisee?.address || "" }
    );
  }

  const adresse = `A1:${colonneExcel(titres.length - 1)}1`;
  await appeler(
    jeton,
    `${classeur(f)}/worksheets/${encodeURIComponent(feuilleId)}/range(address='${adresse}')`,
    { methode: "PATCH", corps: { values: [titres] } }
  );
  const table = await appeler(
    jeton,
    `${classeur(f)}/worksheets/${encodeURIComponent(feuilleId)}/tables/add`,
    { methode: "POST", corps: { address: adresse, hasHeaders: true } }
  );
  if (table?.id) {
    try {
      await appeler(jeton, `${classeur(f)}/tables/${encodeURIComponent(table.id)}`, {
        methode: "PATCH",
        corps: { name: nomTable },
      });
    } catch {
      // Un nom de tableau déjà pris n'est pas un échec : le tableau existe,
      // et c'est son identifiant qu'on garde.
    }
  }
  return table;
}

export async function moi(jeton) {
  return appeler(jeton, "/me?$select=displayName,userPrincipalName");
}
