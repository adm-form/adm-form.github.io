/*
 * LA DÉFINITION DE LA FICHE TERRAIN — UNE SEULE SOURCE.
 *
 * Tout ce qui décrit la fiche est ici : les champs, leurs options, ce qui est
 * obligatoire, ce qui dépend d'autre chose. Les écrans ne font que RENDRE
 * cette liste, et `src/sharepoint/colonnes.js` ne fait que la verser dans les
 * colonnes du fichier Excel. Ajouter une option d'odeur ou un champ se fait
 * donc ICI, en une ligne, et non dans trois fichiers qui finiraient par se
 * contredire.
 *
 * UN TEST VÉRIFIE QUE CHAQUE CHAMP A UNE COLONNE (`tests/colonnes.test.js`) :
 * un champ ajouté ici et oublié là serait saisi par le technicien et jamais
 * écrit dans le fichier — une saisie perdue sans un mot.
 */

export const AEROPORTS = ["YUL", "YMX"];

export const ANALYSES = [
  "HP",
  "HAP",
  "H&G",
  "Métaux",
  "MES",
  "BTEX",
  "Glycol",
  "DCO",
  "DBO5",
  "Coliformes fécaux",
  "SPFA",
  "BPC",
  // CQ n'est pas une analyse : cocher « CQ » dit qu'un DUPLICATA a été prélevé
  // à ce point (contrôle de qualité). Il vit dans la liste pour s'afficher, se
  // cocher et s'écrire dans le fichier comme les autres cases.
  "CQ",
];

export const MATRICES = ["Surface", "Pluvial", "Sanitaire", "Boue"];

// La valeur qui dit « ce n'est pas mesuré », et qui s'écrit telle quelle dans
// le fichier. Un champ VIDE et un champ « non mesuré » ne disent pas la même
// chose : le premier est un oubli, le second une décision.
export const NON_MESURE = "-";

// LE « - » PAR DÉFAUT À YUL. Demandé tel quel : les paramètres physico-chimiques
// ne sont pas relevés à YUL. Ce sont des DÉFAUTS, pas des interdictions — le
// technicien peut toujours saisir une valeur, et elle est alors conservée (voir
// `regles.js` : un champ touché à la main n'est jamais réécrit).
export const CHAMPS_PHYSICO = ["temperature", "oxygene_pct", "oxygene_mgl", "ph"];
export const DEFAUTS_PAR_AEROPORT = {
  YUL: {
    temperature: NON_MESURE,
    oxygene_pct: NON_MESURE,
    oxygene_mgl: NON_MESURE,
    ph: NON_MESURE,
  },
  YMX: {},
};

// Ce qu'un point d'échantillonnage peut remplir tout seul dans la fiche.
// Déclaré ici plutôt qu'en dur dans la règle : le jour où un point porte aussi
// sa méthode habituelle, il n'y a rien d'autre à changer.
export const REMPLI_PAR_LE_POINT = ["matrice", "methode"];

const vide = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);

/*
 * LES CHAMPS, DANS L'ORDRE OÙ LE TECHNICIEN LES REMPLIT.
 *
 * `section`     — regroupement à l'écran.
 * `type`        — `choix`, `multi`, `point`, `texte`, `texte_long`, `nombre`,
 *                 `date`, `heure`.
 * `condition`   — le champ n'existe que si elle est vraie ; un champ caché
 *                 n'est jamais obligatoire et n'est pas écrit.
 * `obligatoire` — bloque l'enregistrement tant qu'il est vide.
 * `borne`       — pour un nombre : AVERTIT, ne refuse pas. Un relevé de terrain
 *                 aberrant est une information, pas une faute de saisie à
 *                 corriger de force ; refuser ferait ressaisir faux.
 */
export const CHAMPS = [
  {
    code: "aeroport",
    etiquette: "Aéroport",
    section: "Campagne",
    type: "choix",
    options: AEROPORTS,
    obligatoire: true,
    aide: "Choisi en premier : à YUL, les paramètres physico-chimiques passent à « - ».",
  },
  {
    code: "campagne",
    etiquette: "Type de campagne",
    section: "Campagne",
    type: "choix",
    options: ["Régulier", "Intensif", "Spécial"],
    defaut: "Régulier",
    obligatoire: true,
  },
  {
    code: "technicien",
    etiquette: "Technicien",
    section: "Campagne",
    type: "texte",
    defaut: "S. Lessard",
    obligatoire: true,
  },
  {
    code: "date",
    etiquette: "Date",
    section: "Campagne",
    type: "date",
    obligatoire: true,
  },
  {
    code: "heure",
    etiquette: "Heure",
    section: "Campagne",
    type: "heure",
    obligatoire: true,
  },

  {
    code: "point",
    etiquette: "Point d'échantillonnage",
    section: "Échantillon",
    type: "point",
    obligatoire: true,
  },
  {
    code: "point_autre",
    etiquette: "Nom du point (autre)",
    section: "Échantillon",
    type: "texte",
    obligatoire: true,
    condition: (v) => v.point === "Autre",
    aide: "Le nom sera écrit tel quel dans le fichier.",
  },
  {
    code: "matrice",
    etiquette: "Matrice",
    section: "Échantillon",
    type: "choix",
    options: MATRICES,
    obligatoire: true,
    aide: "Se remplit toute seule quand le point d'échantillonnage en déclare une.",
  },
  {
    code: "methode",
    etiquette: "Méthode d'échantillonnage",
    section: "Échantillon",
    type: "choix",
    options: ["Perche", "Pompe péristaltique", "Manuelle", "Système", "Inspection visuelle seulement"],
    obligatoire: true,
  },

  {
    code: "turbidite",
    etiquette: "Turbidité",
    section: "Observations",
    type: "choix",
    options: ["Clair", "Trouble", "Opaque"],
  },
  {
    code: "couleur",
    etiquette: "Couleur de l'eau",
    section: "Observations",
    type: "choix",
    options: ["Aucune", "Jaunâtre", "Verdâtre", "Noirâtre", "Grisâtre", "Brunâtre"],
  },
  {
    code: "couleur_intensite",
    etiquette: "Intensité de la couleur",
    section: "Observations",
    type: "choix",
    options: ["Légère", "Moyenne", "Intense"],
    // Pas de couleur, pas d'intensité : une « intensité » sans couleur ne veut
    // rien dire, et laisser le champ ouvert ferait saisir une intensité qui
    // contredirait l'observation.
    condition: (v) => !vide(v.couleur) && v.couleur !== "Aucune",
  },
  {
    code: "odeur",
    etiquette: "Odeur",
    section: "Observations",
    type: "choix",
    options: ["Aucune", "Faible", "Moyenne", "Forte"],
  },
  {
    code: "odeur_nature",
    etiquette: "Nature de l'odeur",
    section: "Observations",
    type: "choix",
    options: ["Glycol", "Organique", "Minérale", "Hydrocarbures"],
    condition: (v) => !vide(v.odeur) && v.odeur !== "Aucune",
  },
  {
    code: "sediments",
    etiquette: "Sédiments",
    section: "Observations",
    type: "choix",
    options: ["Aucun", "Trace", "Moyenne", "Forte"],
  },
  {
    code: "debit",
    etiquette: "Débit",
    section: "Observations",
    type: "choix",
    options: ["Stagnant", "Très faible", "Faible", "Moyen", "Fort"],
  },

  {
    code: "temperature",
    etiquette: "Température",
    unite: "°C",
    section: "Physico-chimie",
    type: "nombre",
    borne: [-5, 40],
  },
  {
    code: "oxygene_pct",
    etiquette: "Oxygène dissous",
    unite: "%",
    section: "Physico-chimie",
    type: "nombre",
    borne: [0, 200],
  },
  {
    code: "oxygene_mgl",
    etiquette: "Oxygène dissous",
    unite: "mg/L",
    section: "Physico-chimie",
    type: "nombre",
    borne: [0, 20],
  },
  {
    code: "ph",
    etiquette: "pH",
    section: "Physico-chimie",
    type: "nombre",
    borne: [0, 14],
  },

  {
    code: "analyses",
    etiquette: "Analyses effectuées",
    section: "Analyses",
    type: "multi",
    options: ANALYSES,
  },
  {
    code: "remarques",
    etiquette: "Remarques",
    section: "Analyses",
    type: "texte_long",
  },
];

export const SECTIONS = ["Campagne", "Échantillon", "Observations", "Physico-chimie", "Analyses"];

export const CHAMP_PAR_CODE = Object.fromEntries(CHAMPS.map((c) => [c.code, c]));

/*
 * CE QUI SURVIT À L'ENREGISTREMENT.
 *
 * Une campagne, c'est trente points dans la même journée, par le même
 * technicien, au même aéroport. Repartir d'une fiche entièrement vide ferait
 * ressaisir trente fois ces quatre champs — et c'est à la trentième qu'on se
 * trompe. En revanche, les OBSERVATIONS ne survivent jamais : une odeur
 * reportée d'un point à l'autre serait une fausse donnée, et c'est exactement
 * le genre d'erreur qu'on ne voit pas en relisant.
 */
export const CHAMPS_PERSISTANTS = ["aeroport", "campagne", "technicien", "date"];

export { vide };
