/*
 * RÉGLAGES — QUATRE ÉTAPES, DANS L'ORDRE, ET CHACUNE DIT SI ELLE EST FAITE.
 *
 * C'est l'écran qu'on ouvre UNE FOIS par tablette, et dans lequel on revient
 * le jour où « ça n'envoie plus ». D'où la forme : des étapes numérotées, un
 * état visible pour chacune, et un CONTRÔLE final qui compare les colonnes du
 * fichier aux champs de la fiche.
 *
 * LE CONTRÔLE EST LA PARTIE UTILE. Un champ du formulaire qui n'a pas de
 * colonne dans le fichier est une saisie perdue : le technicien la remplit,
 * l'envoi réussit, et la valeur ne va nulle part. Rien à l'écran ne le
 * dirait — d'où ce contrôle, et d'où le fait qu'il nomme les champs un par un.
 */
import React, { useState } from "react";
import { ecrire as ecrireReglages, estRelie, peutSeConnecter } from "../reglages.js";
import { ENTETES_DEFAUT } from "../sharepoint/colonnes.js";
import * as graph from "../sharepoint/graph.js";
import { connecter, deconnecter, jeton, compte as compteMicrosoft } from "../sharepoint/auth.js";
import { verifierFichier } from "../sharepoint/envoi.js";

const CARTE = "rounded-2xl bg-white border border-slate-200 p-4 mb-4";
const CHAMP =
  "w-full rounded-xl border border-slate-300 px-3 py-3 bg-white focus:border-teal-600 focus:outline-none";
const BOUTON = "cible px-4 rounded-xl font-semibold bg-teal-700 text-white active:bg-teal-800";
const BOUTON_PALE =
  "cible px-4 rounded-xl font-semibold bg-white border border-slate-300 text-slate-800 active:bg-slate-100";

function Etat({ fait, texte }) {
  return (
    <span
      className={`text-xs rounded-full px-2 py-1 font-semibold ${
        fait ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {texte}
    </span>
  );
}

function Message({ avis }) {
  if (!avis) return null;
  const couleurs = {
    ok: "bg-emerald-50 border-emerald-200 text-emerald-900",
    erreur: "bg-rose-50 border-rose-200 text-rose-900",
    info: "bg-sky-50 border-sky-200 text-sky-900",
  };
  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${couleurs[avis.genre] || couleurs.info}`}>
      {avis.texte}
    </div>
  );
}

export default function Reglages({ reglages, utilisateur, surChangement, surUtilisateur }) {
  const [clientId, setClientId] = useState(reglages.clientId);
  const [tenantId, setTenantId] = useState(reglages.tenantId);
  const [portees, setPortees] = useState(reglages.portees);
  const [lien, setLien] = useState(reglages.lienFichier);
  const [feuilles, setFeuilles] = useState([]);
  const [tables, setTables] = useState([]);
  const [controle, setControle] = useState(null);
  const [avis, setAvis] = useState({});
  const [occupe, setOccupe] = useState("");

  const poser = (cle, genre, texte) => setAvis((a) => ({ ...a, [cle]: { genre, texte } }));

  const enregistrerIdentite = () => {
    const suite = ecrireReglages({ clientId: clientId.trim(), tenantId: tenantId.trim(), portees });
    surChangement(suite);
    poser("identite", "ok", "Enregistré.");
  };

  const seConnecter = async () => {
    const suite = ecrireReglages({ clientId: clientId.trim(), tenantId: tenantId.trim(), portees });
    surChangement(suite);
    try {
      // `loginRedirect` QUITTE la page : tout ce qui suit cette ligne ne
      // s'exécute qu'en cas d'échec immédiat.
      await connecter(suite);
    } catch (e) {
      poser("identite", "erreur", e.message);
    }
  };

  const seDeconnecter = async () => {
    await deconnecter(reglages);
    surUtilisateur(null);
    poser("identite", "info", "Compte retiré de cette tablette.");
  };

  /*
   * ÊTRE CONNECTÉ N'EST PAS AVOIR LE DROIT D'APPELER GRAPH, ET LES DEUX SE
   * CONFONDENT À L'ŒIL. La connexion Microsoft réussit dès que le compte
   * existe ; mais tant que la permission `Files.ReadWrite.All` n'a pas été
   * consentie, le premier appel à Graph est refusé. Sans ce bouton, le défaut
   * n'apparaîtrait qu'à l'étape 2, sous la forme d'un message parlant du
   * FICHIER — on chercherait le lien, pas le consentement.
   */
  const verifierAcces = async () => {
    setOccupe("acces");
    try {
      const j = await jeton(reglages);
      const identite = await graph.moi(j);
      poser(
        "identite",
        "ok",
        `Microsoft Graph répond : ${identite?.displayName || identite?.userPrincipalName}. La permission est accordée.`
      );
    } catch (e) {
      poser(
        "identite",
        "erreur",
        e.genre === "droits" || e.genre === "connexion"
          ? `${e.message} — c'est la signature d'un consentement non accordé : voir DEMANDE_TI.md.`
          : e.message
      );
    } finally {
      setOccupe("");
    }
  };

  const resoudre = async () => {
    setOccupe("fichier");
    try {
      const j = await jeton(reglages);
      const f = await graph.resoudreFichier(j, lien);
      const suite = ecrireReglages({ lienFichier: lien.trim(), ...f, feuille: "", feuilleNom: "", table: "", tableNom: "" });
      surChangement(suite);
      setControle(null);
      poser("fichier", "ok", `Fichier trouvé : ${f.nomFichier}`);
      await chargerClasseur(suite);
    } catch (e) {
      poser("fichier", "erreur", `${e.message}${e.detail ? ` — ${String(e.detail).slice(0, 200)}` : ""}`);
    } finally {
      setOccupe("");
    }
  };

  const chargerClasseur = async (r = reglages) => {
    setOccupe("classeur");
    try {
      const j = await jeton(r);
      const f = { driveId: r.driveId, itemId: r.itemId };
      const [lesFeuilles, lesTables] = await Promise.all([graph.feuilles(j, f), graph.tables(j, f)]);
      setFeuilles(lesFeuilles);
      setTables(lesTables);
      if (!lesTables.length) {
        poser(
          "classeur",
          "info",
          "Ce classeur ne contient aucun tableau. Choisir une feuille VIDE et créer le tableau ci-dessous, ou créer le tableau dans Excel (Insertion > Tableau) sur les colonnes existantes."
        );
      }
    } catch (e) {
      poser("classeur", "erreur", e.message);
    } finally {
      setOccupe("");
    }
  };

  const choisirTable = async (table) => {
    const suite = ecrireReglages({ table: table.id, tableNom: table.name });
    surChangement(suite);
    poser("classeur", "ok", `Les lignes s'ajouteront au tableau « ${table.name} ».`);
    await verifier(suite);
  };

  const creerTable = async (feuille) => {
    setOccupe("creation");
    try {
      const j = await jeton(reglages);
      const f = { driveId: reglages.driveId, itemId: reglages.itemId };
      const table = await graph.creerTable(j, f, feuille.id, ENTETES_DEFAUT);
      const suite = ecrireReglages({
        feuille: feuille.id,
        feuilleNom: feuille.name,
        table: table.id,
        tableNom: table.name,
      });
      surChangement(suite);
      poser("classeur", "ok", `Tableau créé sur « ${feuille.name} » avec ${ENTETES_DEFAUT.length} colonnes.`);
      await chargerClasseur(suite);
      await verifier(suite);
    } catch (e) {
      poser("classeur", "erreur", e.message);
    } finally {
      setOccupe("");
    }
  };

  const verifier = async (r = reglages) => {
    setOccupe("controle");
    try {
      setControle(await verifierFichier(r));
      poser("controle", "ok", "Contrôle effectué.");
    } catch (e) {
      setControle(null);
      poser("controle", "erreur", e.message);
    } finally {
      setOccupe("");
    }
  };

  return (
    <div className="pb-24">
      {/* --- 1. Connexion ------------------------------------------------- */}
      <section className={CARTE}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">1. Connexion Microsoft</h2>
          <Etat fait={Boolean(utilisateur)} texte={utilisateur ? "connecté" : "à faire"} />
        </div>
        {utilisateur ? (
          <p className="text-sm text-slate-600 mb-3">
            {utilisateur.name || utilisateur.username}
            <span className="block text-xs text-slate-500">{utilisateur.username}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-600 mb-3">
            L'application écrit dans le fichier AVEC VOTRE COMPTE : elle n'a accès qu'à ce à quoi
            vous avez déjà accès. L'identifiant d'application se crée une fois, dans Azure — voir
            le fichier <code>README.md</code>, section « Inscription de l'application ».
          </p>
        )}
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Identifiant de l'application (client ID)
        </label>
        <input className={CHAMP} value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        <label className="block text-xs font-semibold text-slate-600 mb-1 mt-3">
          Locataire (tenant) — « organizations » convient dans presque tous les cas
        </label>
        <input className={CHAMP} value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <label className="block text-xs font-semibold text-slate-600 mb-1 mt-3">
          Permissions demandées (laisser vide = User.Read Files.ReadWrite.All)
        </label>
        <input className={CHAMP} value={portees} onChange={(e) => setPortees(e.target.value)} placeholder="User.Read Files.ReadWrite.All" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className={BOUTON_PALE} onClick={enregistrerIdentite}>
            Enregistrer
          </button>
          <button
            type="button"
            className={BOUTON}
            onClick={seConnecter}
            disabled={!clientId.trim()}
          >
            {utilisateur ? "Changer de compte" : "Se connecter"}
          </button>
          {utilisateur ? (
            <>
              <button
                type="button"
                className={BOUTON_PALE}
                onClick={verifierAcces}
                disabled={occupe === "acces"}
              >
                {occupe === "acces" ? "Vérification…" : "Vérifier l'accès à Graph"}
              </button>
              <button type="button" className={BOUTON_PALE} onClick={seDeconnecter}>
                Se déconnecter
              </button>
            </>
          ) : null}
        </div>
        <Message avis={avis.identite} />
      </section>

      {/* --- 2. Le fichier ------------------------------------------------ */}
      <section className={CARTE}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">2. Le fichier Excel du SharePoint</h2>
          <Etat fait={Boolean(reglages.itemId)} texte={reglages.itemId ? "trouvé" : "à faire"} />
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Dans SharePoint ou Teams : ouvrir le dossier, cliquer sur le fichier, « Copier le lien »,
          puis coller ici. Le lien n'est utilisé qu'UNE fois, pour retrouver le fichier ; ensuite
          l'application travaille sur son identifiant, ce qui lui permet de suivre un fichier
          renommé ou déplacé.
        </p>
        <input className={CHAMP} value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://contoso.sharepoint.com/:x:/s/…" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            className={BOUTON}
            onClick={resoudre}
            disabled={!lien.trim() || !peutSeConnecter(reglages) || occupe === "fichier"}
          >
            {occupe === "fichier" ? "Recherche…" : "Trouver le fichier"}
          </button>
          {reglages.webUrl ? (
            <a className={BOUTON_PALE + " inline-flex items-center"} href={reglages.webUrl} target="_blank" rel="noreferrer">
              Ouvrir dans Excel
            </a>
          ) : null}
        </div>
        {reglages.nomFichier ? (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold">{reglages.nomFichier}</span>
          </p>
        ) : null}
        <Message avis={avis.fichier} />
      </section>

      {/* --- 3. Feuille et tableau ---------------------------------------- */}
      <section className={CARTE}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">3. Où écrire les lignes</h2>
          <Etat fait={Boolean(reglages.table)} texte={reglages.table ? reglages.tableNom || "choisi" : "à faire"} />
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Les lignes s'ajoutent à la FIN d'un <strong>tableau</strong> Excel (un vrai tableau, pas
          une simple plage de cellules) : c'est ce qui permet d'ajouter une ligne sans jamais
          toucher au reste du fichier, même s'il est ouvert par quelqu'un d'autre au même moment.
        </p>
        <button
          type="button"
          className={BOUTON_PALE}
          onClick={() => chargerClasseur()}
          disabled={!reglages.itemId || occupe === "classeur"}
        >
          {occupe === "classeur" ? "Lecture…" : "Lire le classeur"}
        </button>

        {tables.length ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Tableaux trouvés :</p>
            <div className="flex flex-wrap gap-2">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cible px-4 rounded-xl border font-medium ${
                    reglages.table === t.id
                      ? "bg-teal-700 border-teal-700 text-white"
                      : "bg-white border-slate-300"
                  }`}
                  onClick={() => choisirTable(t)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {feuilles.length && !tables.length ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Créer le tableau sur une feuille VIDE ({ENTETES_DEFAUT.length} colonnes) :
            </p>
            <div className="flex flex-wrap gap-2">
              {feuilles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={BOUTON_PALE}
                  onClick={() => creerTable(f)}
                  disabled={occupe === "creation"}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Une feuille qui contient déjà des données est REFUSÉE : écrire nos en-têtes
              par-dessus effacerait ce qui s'y trouve.
            </p>
          </div>
        ) : null}
        <Message avis={avis.classeur} />
      </section>

      {/* --- 4. Contrôle -------------------------------------------------- */}
      <section className={CARTE}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">4. Contrôle des colonnes</h2>
          <Etat fait={Boolean(controle?.pret)} texte={controle ? (controle.pret ? "complet" : "incomplet") : "à faire"} />
        </div>
        <button
          type="button"
          className={BOUTON}
          onClick={() => verifier()}
          disabled={!estRelie(reglages) || occupe === "controle"}
        >
          {occupe === "controle" ? "Lecture…" : "Vérifier le fichier"}
        </button>

        {controle ? (
          <div className="mt-3 text-sm space-y-3">
            <p className="text-slate-700">
              {controle.entetes.length} colonne(s) dans le tableau, {controle.lignes} ligne(s) déjà
              présente(s).
            </p>
            {controle.manquants.length ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                <p className="font-semibold">
                  {controle.manquants.length} champ(s) de la fiche n'ont PAS de colonne — ce qui y
                  sera saisi n'ira nulle part :
                </p>
                <p className="mt-1">{controle.manquants.map((m) => m.entete).join(", ")}</p>
                <p className="mt-1 text-xs">
                  Ajouter ces colonnes au tableau Excel (le titre peut différer : « Site » est
                  reconnu pour « Aéroport », par exemple).
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                Tous les champs de la fiche ont une colonne.
              </div>
            )}
            {controle.inconnues.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                <p className="font-semibold">
                  {controle.inconnues.length} colonne(s) du fichier ne sont pas remplies par
                  l'application :
                </p>
                <p className="mt-1">{controle.inconnues.map((c) => c.entete).join(", ")}</p>
                <p className="mt-1 text-xs">
                  Ce n'est pas un défaut : l'application les laisse intactes (y compris leurs
                  formules).
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <Message avis={avis.controle} />
      </section>
    </div>
  );
}
