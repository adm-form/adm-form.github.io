/*
 * LA CORRESPONDANCE ENTRE LA FICHE ET LES COLONNES DU FICHIER EXCEL.
 *
 * ON ÉCRIT DANS LES COLONNES DU FICHIER, PAS DANS LES NÔTRES. L'application
 * LIT la ligne d'en-tête du tableau Excel et place chaque champ sous la
 * colonne qui lui correspond, par son titre. C'est ce qui permet au
 * professionnel de garder SON fichier, avec ses colonnes, dans son ordre — et
 * d'en ajouter une sans que l'application ne s'en trouve mal.
 *
 * Écrire les valeurs dans un ordre fixe serait plus court, et faux au premier
 * déplacement de colonne : les pH se retrouveraient dans « Débit » sans la
 * moindre erreur à l'écran. Un tableau décalé d'une colonne est le genre de
 * défaut qu'on ne voit qu'au moment d'interpréter les résultats, des semaines
 * plus tard.
 *
 * `synonymes` existe pour que « Aéroport », « AEROPORT » et « Site » tombent
 * sur le même champ. La comparaison ignore la casse, les accents, les espaces
 * et la ponctuation (`normaliser`), parce qu'un en-tête de fichier réel porte
 * des parenthèses, des unités et parfois une faute de frappe.
 *
 * TOUT EST PUR ICI : aucun appel réseau, aucun React. `tests/colonnes.test.js`
 * l'éprouve en entier, y compris le cas du champ ajouté au formulaire et
 * oublié dans ce fichier — qui serait une saisie perdue en silence.
 */
import { ANALYSES, CHAMPS, NON_MESURE } from "../fiche/schema.js";
import { nomDuPoint } from "../fiche/regles.js";

export function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // « % » et « & » PORTENT DU SENS : sans eux, « Oxygène dissous (%) » et
    // « Oxygène dissous (mg/L) » se réduisent au même texte, et une mesure
    // irait dans la colonne de l'autre.
    .replace(/%/g, "pct")
    .replace(/&/g, "et")
    .replace(/[^a-z0-9]+/g, "");
}

const horodatage = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const n = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())} ${n(d.getHours())}:${n(d.getMinutes())}`;
};

/*
 * LES COLONNES CONNUES.
 *
 * `creer: false` — la colonne est REMPLIE si le fichier la porte, mais n'est
 * pas créée par l'application. C'est le cas de « Analyses effectuées », qui
 * tient les treize analyses dans une seule case : utile si le fichier existant
 * est fait ainsi, mais une colonne par analyse se filtre et se compte, donc
 * c'est elle qu'on crée.
 */
export const COLONNES = [
  {
    code: "id_fiche",
    entete: "Identifiant de la fiche",
    synonymes: ["ID", "Identifiant", "ID fiche", "GUID"],
    valeur: (f) => f.id || "",
    // Cette colonne n'est pas une coquetterie : c'est elle qui permet de
    // savoir si une fiche déjà envoyée a bien été écrite, quand le réseau a
    // coupé entre l'écriture et la réponse. Voir `envoi.js`.
  },
  {
    code: "date",
    entete: "Date",
    synonymes: ["Date de prélèvement", "Date d'échantillonnage"],
  },
  {
    code: "heure",
    entete: "Heure",
    synonymes: ["Heure de prélèvement", "Heure d'échantillonnage"],
  },
  { code: "aeroport", entete: "Aéroport", synonymes: ["Site", "Airport"] },
  {
    code: "campagne",
    entete: "Type de campagne",
    synonymes: ["Campagne", "Type campagne"],
  },
  {
    code: "technicien",
    entete: "Technicien",
    synonymes: ["Échantillonneur", "Preleveur", "Préleveur", "Nom du technicien"],
  },
  {
    code: "point",
    entete: "Point d'échantillonnage",
    synonymes: ["Point", "ID du point", "Station", "Identifiant du point"],
    // « Autre » est remplacé par le nom saisi : le fichier reçoit le nom du
    // point, jamais le mot « Autre ».
    valeur: (f) => nomDuPoint(f.valeurs),
  },
  { code: "matrice", entete: "Matrice", synonymes: ["Type de matrice", "Réseau"] },
  {
    code: "methode",
    entete: "Méthode d'échantillonnage",
    synonymes: ["Méthode", "Mode de prélèvement"],
  },
  {
    code: "heure_systeme",
    entete: "Heure du prélèvement par le système",
    synonymes: ["Heure système", "Heure du prélèvement système"],
  },
  { code: "turbidite", entete: "Turbidité", synonymes: ["Apparence", "Limpidité"] },
  {
    code: "couleur",
    entete: "Couleur de l'eau",
    synonymes: ["Couleur", "Coloration"],
  },
  {
    code: "couleur_intensite",
    entete: "Intensité de la couleur",
    synonymes: ["Intensité couleur", "Intensité de coloration"],
  },
  { code: "odeur", entete: "Odeur", synonymes: ["Intensité de l'odeur"] },
  {
    code: "odeur_nature",
    entete: "Nature de l'odeur",
    synonymes: ["Type d'odeur", "Odeur (nature)"],
  },
  { code: "sediments", entete: "Sédiments", synonymes: ["Présence de sédiments", "Sediment"] },
  { code: "debit", entete: "Débit", synonymes: ["Écoulement", "Debit"] },
  {
    code: "temperature",
    entete: "Température (°C)",
    synonymes: ["Température", "Temp", "T (°C)", "Temp. (°C)"],
  },
  {
    code: "oxygene_pct",
    entete: "Oxygène dissous (%)",
    synonymes: ["OD (%)", "O2 dissous (%)", "Saturation en oxygène", "OD %"],
  },
  {
    code: "oxygene_mgl",
    entete: "Oxygène dissous (mg/L)",
    synonymes: ["OD (mg/L)", "O2 dissous (mg/L)", "OD mg/L"],
  },
  { code: "ph", entete: "pH", synonymes: ["pH (unités)", "potentiel hydrogène"] },
  {
    code: "analyses",
    entete: "Analyses effectuées",
    synonymes: ["Analyses", "Analyses demandées", "Paramètres analysés"],
    creer: false,
    valeur: (f) => (f.valeurs.analyses || []).join(", "),
  },
];

/*
 * LA QUEUE DU TABLEAU — APRÈS LES ANALYSES.
 *
 * Les remarques sont le seul champ de longueur libre : placées au milieu, elles
 * repoussent tout le reste hors de l'écran dès qu'on lit le fichier. Elles
 * viennent donc en fin de ligne, avec l'horodatage de saisie.
 */
export const COLONNES_FIN = [
  {
    code: "cq",
    entete: "CQ",
    synonymes: ["Duplicata", "Duplicata (CQ)", "Contrôle qualité", "Contrôle de qualité"],
    // Les fiches saisies quand « CQ » était une case des analyses la portent
    // encore dans `analyses` : on les lit comme « Oui » plutôt que de perdre
    // l'information.
    valeur: (f) => f.valeurs.cq || ((f.valeurs.analyses || []).includes("CQ") ? "Oui" : ""),
  },
  { code: "remarques", entete: "Remarques", synonymes: ["Commentaires", "Notes", "Observations"] },
  {
    code: "saisie_le",
    entete: "Saisie le",
    synonymes: ["Horodatage", "Saisi le", "Date de saisie"],
    valeur: (f) => horodatage(f.cree_le),
  },
];

/* UNE COLONNE PAR ANALYSE : ça se filtre, ça se compte, ça se somme. Une seule
 * colonne « HP, HAP, Métaux » ne permet aucun des trois. */
export const COLONNES_ANALYSES = ANALYSES.map((nom) => ({
  code: `analyse:${nom}`,
  entete: nom,
  analyse: nom,
  synonymes:
    nom === "H&G"
      ? ["HG", "H et G", "Huiles et graisses"]
      : nom === "Coliformes fécaux"
        ? ["Coliformes", "CF"]
        : nom === "Métaux"
          ? ["Metaux", "Métaux lourds"]
          : [],
  valeur: (f, reglages) =>
    (f.valeurs.analyses || []).includes(nom) ? reglages?.marqueAnalyse || "X" : "",
}));

export const TOUTES_COLONNES = [...COLONNES, ...COLONNES_ANALYSES, ...COLONNES_FIN];

/* L'en-tête que l'application écrit quand elle CRÉE le tableau. */
export const ENTETES_DEFAUT = TOUTES_COLONNES.filter((c) => c.creer !== false).map((c) => c.entete);

const CLES_PAR_COLONNE = new Map();
for (const colonne of TOUTES_COLONNES) {
  for (const titre of [colonne.entete, ...(colonne.synonymes || [])]) {
    const cle = normaliser(titre);
    if (!CLES_PAR_COLONNE.has(cle)) CLES_PAR_COLONNE.set(cle, colonne);
  }
}

export function colonnePourEntete(entete) {
  return CLES_PAR_COLONNE.get(normaliser(entete)) || null;
}

/*
 * LE CONTRÔLE DU FICHIER, montré dans l'écran Réglages.
 *
 * Il répond à trois questions, et les trois comptent :
 *   - quelle colonne du fichier reçoit quel champ (`parIndex`) ;
 *   - quels champs n'ont NULLE PART où aller (`manquants`) — c'est la saisie
 *     perdue, et c'est le seul vrai défaut ;
 *   - quelles colonnes du fichier l'application ne remplira pas
 *     (`inconnues`) — ce n'est PAS un défaut : le fichier a le droit d'avoir
 *     ses propres colonnes (numéro de laboratoire, résultats…), et
 *     l'application les laisse intactes.
 */
export function controle(entetes) {
  const liste = Array.isArray(entetes) ? entetes : [];
  const parIndex = liste.map((e) => colonnePourEntete(e)?.code || null);
  const parCode = {};
  parIndex.forEach((code, i) => {
    if (code && !(code in parCode)) parCode[code] = i;
  });

  const inconnues = liste
    .map((entete, index) => ({ entete, index }))
    .filter((e) => !parIndex[e.index] && String(e.entete || "").trim() !== "");

  const combineePresente = "analyses" in parCode;
  const manquants = [];
  for (const colonne of TOUTES_COLONNES) {
    if (colonne.code in parCode) continue;
    if (colonne.code === "analyses") continue; // couverte par les colonnes par analyse
    if (colonne.analyse && combineePresente) continue; // couverte par la colonne unique
    manquants.push({ code: colonne.code, entete: colonne.entete });
  }

  return { parIndex, parCode, inconnues, manquants, pret: manquants.length === 0 };
}

function valeurBrute(colonne, fiche, reglages) {
  if (colonne.valeur) return colonne.valeur(fiche, reglages);
  const v = fiche.valeurs?.[colonne.code];
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}

/*
 * LA LIGNE À AJOUTER, DANS L'ORDRE DES COLONNES DU FICHIER.
 *
 * Une colonne que l'application ne connaît pas reçoit `null` — et pas `""` :
 * Graph laisse alors la cellule TELLE QUELLE, tandis qu'une chaîne vide
 * l'écraserait. Sur une colonne portant une formule (un calcul du
 * professionnel, une mise en forme conditionnelle), la différence est entre
 * « on n'y touche pas » et « on l'efface ».
 */
export function ligne(entetes, fiche, reglages = {}) {
  const { parIndex } = controle(entetes);
  return parIndex.map((code) => {
    if (!code) return null;
    const colonne = TOUTES_COLONNES.find((c) => c.code === code);
    const valeur = valeurBrute(colonne, fiche, reglages);
    return valeur === "" ? "" : valeur;
  });
}

/* Ce que CETTE fiche perdrait faute de colonne : seuls les champs REMPLIS. */
export function perdues(entetes, fiche, reglages = {}) {
  const { parCode } = controle(entetes);
  const combineePresente = "analyses" in parCode;
  const sortie = [];
  for (const colonne of TOUTES_COLONNES) {
    if (colonne.code in parCode) continue;
    if (colonne.code === "analyses" && !combineePresente) {
      // Pas de colonne unique : les analyses passent par leurs colonnes
      // propres, vérifiées juste après.
      continue;
    }
    if (colonne.analyse && combineePresente) continue;
    const valeur = valeurBrute(colonne, fiche, reglages);
    if (valeur !== "" && valeur !== null && valeur !== undefined) {
      sortie.push({ code: colonne.code, entete: colonne.entete, valeur });
    }
  }
  return sortie;
}

/* Tous les champs du formulaire ont-ils une colonne déclarée ici ? (test) */
export function champsSansColonne() {
  const codes = new Set(TOUTES_COLONNES.map((c) => c.code));
  return CHAMPS.map((c) => c.code).filter((code) => code !== "point_autre" && !codes.has(code));
}

export { NON_MESURE };
