/* eslint-env serviceworker */
/*
 * LE SERVICE WORKER MET EN CACHE L'APPLICATION, JAMAIS LE TRAVAIL.
 *
 * Deux mécanismes distincts, et les confondre est le piège :
 *   - CE FICHIER rend l'application ouvrable sans réseau (HTML, JS, CSS,
 *     icônes). Un technicien dans un tunnel de service doit pouvoir ouvrir
 *     l'app et remplir sa fiche.
 *   - LA FILE D'ATTENTE (`src/donnees/file.js`, IndexedDB) garde les fiches
 *     saisies hors ligne et les verse dans le fichier Excel au retour du
 *     réseau. C'est elle qui protège le travail, pas le cache.
 *
 * On ne met JAMAIS en cache un appel à Microsoft Graph : une réponse d'API
 * rejouée depuis un cache ferait croire qu'une fiche est partie alors qu'elle
 * ne l'est pas. Graph est sur une autre origine, donc jamais intercepté — et
 * la garde ci-dessous le dit explicitement plutôt que de s'y fier.
 *
 * UN SERVICE WORKER QUI SERT DU CODE PÉRIMÉ EST PIRE QUE PAS DE SERVICE
 * WORKER : le cache survit au redémarrage et à la mise à jour, et
 * l'utilisateur n'a aucun moyen de le vider. D'où :
 *   - le HTML (la navigation) est en RÉSEAU D'ABORD, cache en secours ;
 *   - les fichiers versionnés par Vite (empreinte dans le nom) sont en cache
 *     d'abord : un même nom ne peut pas désigner deux contenus ;
 *   - à l'activation, tout cache d'une version antérieure est détruit.
 *
 * `VERSION` est le seul levier de purge. La monter à chaque mise en ligne.
 */
const VERSION = "fiches-terrain-v1";
const COQUILLE = `${VERSION}-coquille`;

// Volontairement court : le reste se met en cache au fil de l'usage. Une liste
// exhaustive écrite à la main deviendrait fausse au premier fichier ajouté.
const INDISPENSABLE = ["/", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(COQUILLE)
      // `allSettled` et non `addAll` : `addAll` est tout ou rien, donc une
      // seule URL absente supprimerait le service worker entier, sans message.
      .then((c) => Promise.allSettled(INDISPENSABLE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))))
      // Sans `claim`, la nouvelle version n'agit qu'au prochain démarrage
      // complet — sur une tablette qu'on ne ferme jamais, ce peut être dans
      // trois semaines.
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Tout ce qui n'est pas l'application passe au réseau sans interception :
  // Microsoft Graph, la connexion Microsoft, et tout le reste.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(COQUILLE).then((c) => c.put("/", copie));
          return rep;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (trouve) =>
        trouve ||
        fetch(req).then((rep) => {
          // Une 404 ou une réponse partielle mise en cache se rejouerait
          // indéfiniment : on ne garde que les réponses complètes et saines.
          if (rep && rep.ok && rep.type === "basic") {
            const copie = rep.clone();
            caches.open(COQUILLE).then((c) => c.put(req, copie));
          }
          return rep;
        })
    )
  );
});
