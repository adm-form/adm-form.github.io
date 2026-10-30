/*
 * LA CONNEXION MICROSOFT — AU NOM DU TECHNICIEN, PAS AU NOM D'UN SERVEUR.
 *
 * L'application n'a PAS de serveur, et c'est une décision : elle parle
 * directement à Microsoft Graph depuis la tablette, avec le compte Microsoft
 * 365 du technicien. Trois conséquences, toutes bonnes :
 *   - AUCUN SECRET à garder. Un « client public » avec PKCE n'a pas de mot de
 *     passe d'application ; l'identifiant d'application n'est pas
 *     confidentiel. Un secret posé dans une page web serait lisible par
 *     n'importe qui — c'est pour cela que ce schéma n'en emploie aucun.
 *   - LES DROITS SONT CEUX DE LA PERSONNE. Si elle n'a pas accès au
 *     SharePoint, l'application ne l'a pas non plus. Rien à administrer de
 *     notre côté, et aucune porte dérobée vers les fichiers d'un autre.
 *   - LE FICHIER EXCEL RESTE LA SEULE VÉRITÉ. Pas de base intermédiaire, donc
 *     pas de deuxième version des faits à réconcilier.
 *
 * REDIRECTION ET NON FENÊTRE SURGISSANTE : dans une application installée sur
 * l'écran d'accueil (iPad, Android), une fenêtre surgissante s'ouvre hors de
 * l'application — quand elle n'est pas bloquée purement et simplement.
 *
 * `cacheLocation: localStorage` : le jeton doit survivre à la fermeture de
 * l'application. Avec `sessionStorage`, le technicien se reconnecterait à
 * chaque ouverture, c'est-à-dire sur le terrain, sans réseau, donc jamais.
 */
import { PublicClientApplication } from "@azure/msal-browser";

export const PORTEES_DEFAUT = ["User.Read", "Files.ReadWrite.All"];

export class ErreurAuth extends Error {
  constructor(message, genre) {
    super(message);
    this.name = "ErreurAuth";
    this.genre = genre; // 'non_configure' | 'non_connecte' | 'interaction_requise'
  }
}

let application = null;
let signature = null;

function portees(reglages) {
  const brut = String(reglages?.portees || "").trim();
  return brut ? brut.split(/[\s,]+/) : PORTEES_DEFAUT;
}

export async function initialiser(reglages) {
  if (!reglages?.clientId) {
    throw new ErreurAuth(
      "Aucun identifiant d'application Azure n'est enregistré (écran Réglages).",
      "non_configure"
    );
  }
  const cle = `${reglages.clientId}|${reglages.tenantId || "organizations"}`;
  if (application && signature === cle) return application;

  application = new PublicClientApplication({
    auth: {
      clientId: reglages.clientId,
      authority: `https://login.microsoftonline.com/${reglages.tenantId || "organizations"}`,
      // BASE_URL : « / » en développement comme sur GitHub
      // Pages. L'URI inscrite dans Azure doit correspondre au caractère près.
      redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
      navigateToLoginRequestUrl: true,
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
  });
  await application.initialize();

  // À TRAITER AVANT TOUT LE RESTE : au retour de la redirection, la réponse de
  // Microsoft est dans l'URL. Ne pas la consommer laisserait l'application
  // croire que personne n'est connecté juste après une connexion réussie.
  const resultat = await application.handleRedirectPromise();
  const compte = resultat?.account || application.getAllAccounts()[0] || null;
  if (compte) application.setActiveAccount(compte);

  signature = cle;
  return application;
}

export async function connecter(reglages) {
  const app = await initialiser(reglages);
  await app.loginRedirect({ scopes: portees(reglages) });
}

export async function deconnecter(reglages) {
  try {
    const app = await initialiser(reglages);
    const compte = app.getActiveAccount();
    if (compte) await app.clearCache({ account: compte });
    else await app.clearCache();
  } catch {
    /* Déjà déconnecté, ou pas encore configuré : il n'y a rien à faire. */
  }
  application = null;
  signature = null;
}

export async function compte(reglages) {
  try {
    const app = await initialiser(reglages);
    return app.getActiveAccount();
  } catch {
    return null;
  }
}

/*
 * LE JETON.
 *
 * `interactifPermis` est FAUX par défaut, et c'est important : la file
 * d'attente s'envoie en arrière-plan, et une redirection déclenchée toute
 * seule arracherait le technicien à la fiche qu'il remplit. Quand une
 * interaction est nécessaire, on le DIT et on laisse le geste à l'écran
 * Réglages.
 */
export async function jeton(reglages, { interactifPermis = false } = {}) {
  const app = await initialiser(reglages);
  const actif = app.getActiveAccount();
  if (!actif) {
    if (interactifPermis) {
      await app.loginRedirect({ scopes: portees(reglages) });
      return null;
    }
    throw new ErreurAuth("Aucun compte Microsoft connecté.", "non_connecte");
  }
  try {
    const r = await app.acquireTokenSilent({ account: actif, scopes: portees(reglages) });
    return r.accessToken;
  } catch (e) {
    if (interactifPermis) {
      await app.acquireTokenRedirect({ account: actif, scopes: portees(reglages) });
      return null;
    }
    throw new ErreurAuth(
      "La session Microsoft doit être renouvelée (écran Réglages).",
      "interaction_requise"
    );
  }
}
