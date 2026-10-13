/*
 * LES RÉGLAGES DE CETTE TABLETTE — gardés dans le navigateur, jamais dans le
 * dépôt.
 *
 * Ils portent de quoi atteindre UN fichier Excel sur UN SharePoint :
 * l'identifiant de l'application Azure (public, ce n'est pas un secret — voir
 * le README), le fichier résolu une fois pour toutes, et la feuille / le
 * tableau où les lignes s'ajoutent.
 *
 * TOUTE LECTURE EST SOUS `try` : en navigation privée, ou avec le stockage
 * bloqué par une politique d'entreprise, `localStorage` LÈVE au lieu de rendre
 * vide. Un accès nu ferait un écran blanc au démarrage, sans message.
 */
const CLE = "fiches-terrain:reglages";

export const REGLAGES_DEFAUT = {
  // --- Connexion Microsoft ---
  clientId: "",
  // `organizations` convient à la plupart des cas (tout compte professionnel).
  // Mettre l'identifiant du locataire pour n'autoriser que celui de l'ADM.
  tenantId: "organizations",
  // Les permissions demandées à Microsoft. Vide = `User.Read
  // Files.ReadWrite.All`, le minimum pour écrire dans un fichier auquel la
  // personne a déjà accès. Réglable parce qu'une direction informatique peut
  // imposer une autre permission (`Sites.ReadWrite.All`, par exemple) : mieux
  // vaut un champ de réglage qu'une modification du code.
  portees: "",

  // --- Le fichier Excel, résolu depuis son lien de partage ---
  lienFichier: "",
  driveId: "",
  itemId: "",
  nomFichier: "",
  webUrl: "",

  // --- Où écrire dans le classeur ---
  // Les IDENTIFIANTS servent aux appels (ils traversent une URL sans rien
  // casser), les NOMS ne servent qu'à l'affichage.
  feuille: "",
  feuilleNom: "",
  table: "",
  tableNom: "",

  // La marque posée dans une colonne d'analyse demandée.
  marqueAnalyse: "X",
};

export function lire() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { ...REGLAGES_DEFAUT };
    const garde = JSON.parse(brut);
    // On ne garde que les clés connues : un réglage périmé resté en mémoire
    // ne doit pas réapparaître après une mise à jour qui l'a retiré.
    const sortie = { ...REGLAGES_DEFAUT };
    for (const cle of Object.keys(REGLAGES_DEFAUT)) {
      if (typeof garde?.[cle] === typeof REGLAGES_DEFAUT[cle]) sortie[cle] = garde[cle];
    }
    return sortie;
  } catch {
    return { ...REGLAGES_DEFAUT };
  }
}

export function ecrire(partiel) {
  const suite = { ...lire(), ...partiel };
  try {
    localStorage.setItem(CLE, JSON.stringify(suite));
  } catch {
    /* Rien à faire : les réglages ne survivront pas à la fermeture, et
       l'écran Réglages le dira plutôt que d'échouer en silence. */
  }
  return suite;
}

/* Peut-on se connecter ? (identifiant d'application posé) */
export function peutSeConnecter(r) {
  return Boolean(r?.clientId);
}

/* Peut-on écrire une ligne ? (fichier résolu ET tableau choisi) */
export function estRelie(r) {
  return Boolean(r?.clientId && r?.driveId && r?.itemId && r?.table);
}
