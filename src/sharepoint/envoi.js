/*
 * VERSER LA FILE D'ATTENTE DANS LE FICHIER EXCEL.
 *
 * DANS L'ORDRE DE SAISIE, UNE FICHE À LA FOIS. Envoyer en parallèle mettrait
 * les lignes du fichier dans un ordre qui n'est pas celui de la journée, et
 * deux `rows/add` simultanés sur le même tableau sont un bon moyen d'obtenir
 * un verrou.
 *
 * UN ÉCHEC NE SE TRAITE PAS COMME LES AUTRES, ET C'EST TOUT L'INTÉRÊT :
 *   - plus de réseau, session expirée, droit manquant, fichier introuvable :
 *     la fiche suivante échouerait à l'identique. ON ARRÊTE la tournée et on
 *     affiche UN message, au lieu de quatre-vingt-dix lignes rouges ;
 *   - un refus propre à CETTE fiche (une valeur que le classeur rejette) :
 *     on la marque et on CONTINUE. Bloquer toute la journée sur une fiche
 *     fautive serait pire.
 *
 * LA DOUBLE ÉCRITURE EST LE VRAI PIÈGE, ET ELLE EST MUETTE. Si le réseau
 * coupe APRÈS que Microsoft a écrit la ligne mais AVANT que la réponse
 * n'arrive, la fiche reste « en attente » alors qu'elle est déjà dans le
 * fichier : la rejouer la dupliquerait. D'où la colonne « Identifiant de la
 * fiche » et la vérification ci-dessous, faite UNIQUEMENT pour les fiches qui
 * ont déjà connu une tentative — un essai neuf n'a rien à vérifier.
 */
import * as graph from "./graph.js";
import * as fileAttente from "../donnees/file.js";
import { controle, ligne, perdues } from "./colonnes.js";
import { estRelie } from "../reglages.js";
import { jeton, ErreurAuth } from "./auth.js";

const ARRETE_LA_TOURNEE = new Set([
  "hors_ligne",
  "connexion",
  "droits",
  "introuvable",
  "occupe",
  "trop_vite",
  "serveur",
]);

/* Vrai si cette fiche est déjà une ligne du tableau. */
async function dejaEcrite(contexte, idFiche) {
  if (!("id_fiche" in contexte.corr.parCode)) return false; // pas de colonne : rien à vérifier
  if (!contexte.identifiants) {
    const titre = contexte.entetes[contexte.corr.parCode.id_fiche];
    try {
      const valeurs = await graph.valeursDeColonne(contexte.jeton, contexte.fichier, contexte.table, titre);
      // La première valeur est l'en-tête lui-même ; la garder ne gêne pas, un
      // identifiant de fiche ne ressemble pas à un titre de colonne.
      contexte.identifiants = new Set(valeurs.map((v) => v.trim()));
    } catch {
      // Ne pas pouvoir vérifier n'est pas une raison de ne pas envoyer : on
      // préfère un doublon visible (il porte le même identifiant) à une fiche
      // perdue.
      contexte.identifiants = new Set();
    }
  }
  return contexte.identifiants.has(String(idFiche).trim());
}

export async function envoyerUne(contexte, fiche) {
  if (fiche.tentatives > 0 && (await dejaEcrite(contexte, fiche.id))) {
    await fileAttente.majFiche(fiche.id, {
      etat: fileAttente.ENVOYEE,
      envoye_le: new Date().toISOString(),
      erreur: "",
      note: "Déjà présente dans le fichier : l'envoi précédent avait abouti.",
    });
    return { etat: "deja_presente" };
  }

  const valeurs = ligne(contexte.entetes, fiche, contexte.reglages);
  const manquees = perdues(contexte.entetes, fiche, contexte.reglages);

  try {
    await graph.ajouterLigne(contexte.jeton, contexte.fichier, contexte.table, valeurs);
  } catch (e) {
    const genre = e instanceof graph.ErreurGraph ? e.genre : "refus";
    await fileAttente.majFiche(fiche.id, {
      etat: fileAttente.ERREUR,
      tentatives: (fiche.tentatives || 0) + 1,
      erreur: `${e.message}${e.detail ? ` (${String(e.detail).slice(0, 200)})` : ""}`,
    });
    return { etat: "echec", genre, erreur: e };
  }

  if (contexte.identifiants) contexte.identifiants.add(String(fiche.id).trim());
  await fileAttente.majFiche(fiche.id, {
    etat: fileAttente.ENVOYEE,
    envoye_le: new Date().toISOString(),
    tentatives: (fiche.tentatives || 0) + 1,
    erreur: "",
    note: manquees.length
      ? `Envoyée, mais ${manquees.length} champ(s) n'ont pas de colonne dans le fichier : ${manquees
          .map((m) => m.entete)
          .join(", ")}`
      : "",
  });
  return { etat: "envoyee", manquees };
}

/*
 * LA TOURNÉE COMPLÈTE.
 *
 * Rend un compte rendu plutôt que de lever : l'appelant est un écran, et il
 * doit pouvoir dire « 7 envoyées, arrêt faute de réseau » en une phrase.
 */
export async function envoyerTout(reglages, { surAvancement = () => {} } = {}) {
  const attente = (await fileAttente.enAttente()).filter((f) => f.etat !== fileAttente.ENVOYEE);
  if (!attente.length) return { envoyees: 0, echecs: 0, restantes: 0, arret: null, message: "Rien à envoyer." };

  if (!estRelie(reglages)) {
    return {
      envoyees: 0,
      echecs: 0,
      restantes: attente.length,
      arret: "non_configure",
      message: "Le fichier Excel n'est pas encore relié (écran Réglages).",
    };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      envoyees: 0,
      echecs: 0,
      restantes: attente.length,
      arret: "hors_ligne",
      message: graph.MESSAGES.hors_ligne,
    };
  }

  let jetonAcces;
  try {
    jetonAcces = await jeton(reglages);
  } catch (e) {
    return {
      envoyees: 0,
      echecs: 0,
      restantes: attente.length,
      arret: e instanceof ErreurAuth ? e.genre : "connexion",
      message: e.message,
    };
  }

  const fichier = { driveId: reglages.driveId, itemId: reglages.itemId };
  let entetes;
  try {
    entetes = await graph.entetes(jetonAcces, fichier, reglages.table);
  } catch (e) {
    return {
      envoyees: 0,
      echecs: 0,
      restantes: attente.length,
      arret: e.genre || "refus",
      message: `${e.message} (lecture des colonnes du tableau)`,
    };
  }

  const contexte = {
    jeton: jetonAcces,
    reglages,
    fichier,
    table: reglages.table,
    entetes,
    corr: controle(entetes),
    identifiants: null,
  };

  let envoyees = 0;
  let echecs = 0;
  let arret = null;
  let message = "";

  for (let i = 0; i < attente.length; i++) {
    const fiche = attente[i];
    surAvancement({ courant: i + 1, total: attente.length, fiche });
    const resultat = await envoyerUne(contexte, fiche);
    if (resultat.etat === "envoyee" || resultat.etat === "deja_presente") {
      envoyees++;
      continue;
    }
    echecs++;
    if (ARRETE_LA_TOURNEE.has(resultat.genre)) {
      arret = resultat.genre;
      message = resultat.erreur.message;
      break;
    }
  }

  const restantes = (await fileAttente.enAttente()).length;
  if (!message) {
    message = echecs
      ? `${envoyees} fiche(s) envoyée(s), ${echecs} refusée(s).`
      : `${envoyees} fiche(s) envoyée(s).`;
  }
  return { envoyees, echecs, restantes, arret, message };
}

/* Le contrôle du fichier, pour l'écran Réglages : colonnes vues, champs sans
 * colonne, et le nombre de lignes déjà présentes. */
export async function verifierFichier(reglages) {
  const jetonAcces = await jeton(reglages);
  const fichier = { driveId: reglages.driveId, itemId: reglages.itemId };
  const titres = await graph.entetes(jetonAcces, fichier, reglages.table);
  const lignes = await graph.nombreDeLignes(jetonAcces, fichier, reglages.table);
  return { entetes: titres, lignes, ...controle(titres) };
}
