/*
 * LA COQUILLE — QUATRE ÉCRANS, LA BARRE EN BAS.
 *
 * LA BARRE DE NAVIGATION EST EN BAS, l'inverse d'une application de bureau :
 * sur une tablette tenue à deux mains, le haut de l'écran est hors de portée
 * des pouces.
 *
 * L'ÉTAT DE L'ENVOI EST TOUJOURS VISIBLE, en haut, en une ligne. C'est la
 * seule question que le technicien se pose vraiment : « est-ce que mes fiches
 * sont parties ? » Une application qui ne répond pas à ça fait rouvrir le
 * fichier Excel sur un téléphone pour vérifier.
 */
import React, { useCallback, useEffect, useState } from "react";
import Formulaire from "./fiche/Formulaire.jsx";
import FileAttente from "./ecrans/FileAttente.jsx";
import Points from "./ecrans/Points.jsx";
import Reglages from "./ecrans/Reglages.jsx";
import * as fileAttente from "./donnees/file.js";
import * as referentiel from "./donnees/points.js";
import { estRelie, lire as lireReglages } from "./reglages.js";
import { envoyerTout } from "./sharepoint/envoi.js";
import { compte as compteMicrosoft } from "./sharepoint/auth.js";

const ONGLETS = [
  { id: "fiche", titre: "Fiche" },
  { id: "file", titre: "Envois" },
  { id: "points", titre: "Points" },
  { id: "reglages", titre: "Réglages" },
];

export default function App() {
  const [page, setPage] = useState("fiche");
  const [reglages, setReglages] = useState(() => lireReglages());
  const [points, setPoints] = useState(() => referentiel.lire());
  const [attente, setAttente] = useState(0);
  const [enLigne, setEnLigne] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [dernierMessage, setDernierMessage] = useState("");
  const [utilisateur, setUtilisateur] = useState(null);

  const compterAttente = useCallback(async () => {
    setAttente((await fileAttente.enAttente()).length);
  }, []);

  const synchroniser = useCallback(
    async (reglagesCourants = reglages) => {
      if (!estRelie(reglagesCourants)) return null;
      setEnvoiEnCours(true);
      try {
        const bilan = await envoyerTout(reglagesCourants);
        setDernierMessage(bilan.message);
        return bilan;
      } catch (e) {
        // Un envoi ne doit JAMAIS faire tomber l'écran : la fiche est déjà
        // enregistrée localement, et c'est ce qui compte.
        setDernierMessage(`Envoi interrompu : ${e.message}`);
        return null;
      } finally {
        setEnvoiEnCours(false);
        await compterAttente();
      }
    },
    [reglages, compterAttente]
  );

  // Au démarrage : consommer la réponse de la connexion Microsoft (elle revient
  // dans l'URL après la redirection), compter la file, et tenter un envoi.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const r = lireReglages();
      if (!vivant) return;
      setReglages(r);
      try {
        const c = await compteMicrosoft(r);
        if (vivant) setUtilisateur(c);
      } catch {
        /* pas encore configuré : l'écran Réglages le dira */
      }
      await compterAttente();
      if (vivant) await synchroniser(r);
    })();
    return () => {
      vivant = false;
    };
    // Volontairement au seul montage : cet effet consomme la redirection, et
    // le rejouer à chaque changement de réglages relancerait un envoi en
    // pleine saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LE RETOUR DU RÉSEAU EST L'ÉVÉNEMENT QUI COMPTE : c'est là que la journée
  // part dans le fichier, sans que personne n'ait à y penser.
  useEffect(() => {
    const monter = () => {
      setEnLigne(true);
      synchroniser();
    };
    const descendre = () => setEnLigne(false);
    window.addEventListener("online", monter);
    window.addEventListener("offline", descendre);
    return () => {
      window.removeEventListener("online", monter);
      window.removeEventListener("offline", descendre);
    };
  }, [synchroniser]);

  const majReglages = (suite) => {
    setReglages(suite);
  };

  const majPoints = (suite) => {
    referentiel.ecrire(suite);
    setPoints(suite);
  };

  const relie = estRelie(reglages);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="zone-sure-haut cotes-surs pb-2 bg-teal-800 text-white sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">Fiches Terrain</h1>
            <p className="text-xs text-teal-100 truncate">
              {relie
                ? reglages.nomFichier || "fichier relié"
                : "fichier Excel non relié — les fiches restent dans la tablette"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!enLigne ? (
              <span className="text-xs rounded-full bg-amber-400 text-amber-950 px-2 py-1 font-semibold">
                hors ligne
              </span>
            ) : null}
            {attente > 0 ? (
              <span className="text-xs rounded-full bg-white text-teal-900 px-2 py-1 font-semibold">
                {attente} en attente
              </span>
            ) : (
              <span className="text-xs rounded-full bg-teal-700 text-teal-50 px-2 py-1">à jour</span>
            )}
            {envoiEnCours ? <span className="text-xs text-teal-100">envoi…</span> : null}
          </div>
        </div>
      </header>

      <main className="cotes-surs py-4 max-w-3xl mx-auto">
        {page === "fiche" ? (
          <Formulaire
            reglages={reglages}
            points={points}
            surEnregistrement={async () => {
              await compterAttente();
              await synchroniser();
            }}
          />
        ) : null}
        {page === "file" ? (
          <FileAttente
            reglages={reglages}
            enLigne={enLigne}
            envoiEnCours={envoiEnCours}
            dernierMessage={dernierMessage}
            surEnvoi={synchroniser}
            surChangement={compterAttente}
          />
        ) : null}
        {page === "points" ? <Points points={points} surChangement={majPoints} /> : null}
        {page === "reglages" ? (
          <Reglages
            reglages={reglages}
            utilisateur={utilisateur}
            surChangement={majReglages}
            surUtilisateur={setUtilisateur}
          />
        ) : null}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 zone-sure-bas cotes-surs pt-0">
        <div className="flex max-w-3xl mx-auto">
          {ONGLETS.map((onglet) => (
            <button
              key={onglet.id}
              type="button"
              onClick={() => setPage(onglet.id)}
              className={`flex-1 cible text-sm font-semibold ${
                page === onglet.id ? "text-teal-800" : "text-slate-500"
              }`}
            >
              <span className="relative inline-block">
                {onglet.titre}
                {onglet.id === "file" && attente > 0 ? (
                  <span className="absolute -top-1 -right-4 text-[10px] rounded-full bg-rose-600 text-white px-1.5">
                    {attente}
                  </span>
                ) : null}
              </span>
              <span
                className={`block h-0.5 mt-1 rounded-full ${
                  page === onglet.id ? "bg-teal-700" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
