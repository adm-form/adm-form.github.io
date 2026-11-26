/*
 * LES ENVOIS — CE QUI EST PARTI, CE QUI ATTEND, ET POURQUOI.
 *
 * RIEN N'EST SUPPRIMÉ TOUT SEUL APRÈS L'ENVOI. Le technicien doit pouvoir
 * relire ce qui est parti sans ouvrir le fichier Excel sur son téléphone. Une
 * file qui se vide d'elle-même laisse sans preuve : s'il manque une ligne dans
 * le fichier le lendemain, il n'y a plus rien à comparer.
 *
 * L'EXPORT CSV EST LA SORTIE DE SECOURS, et elle existe même quand tout va
 * bien : une application qui enferme trente fiches dans une tablette sans
 * moyen de les en sortir n'a pas le droit d'exister.
 */
import React, { useCallback, useEffect, useState } from "react";
import * as fileAttente from "../donnees/file.js";
import { resume } from "../fiche/regles.js";
import { csv, nomDuFichier, repartirParAeroport, telecharger } from "../donnees/csv.js";
import { classeur, nomXlsx, partagerFichiers, telechargerBlob } from "../donnees/xlsx.js";
import {
  creerPdfBordereaux,
  grouperPhotosParType,
  nomPdf,
} from "../donnees/photos.js";
import PhotosBordereau from "./PhotosBordereau.jsx";
import { estRelie } from "../reglages.js";

const BOUTON = "cible px-4 rounded-xl font-semibold bg-teal-700 text-white active:bg-teal-800";
const BOUTON_PALE =
  "cible px-4 rounded-xl font-semibold bg-white border border-slate-300 text-slate-800 active:bg-slate-100";

const PASTILLES = {
  [fileAttente.ENVOYEE]: ["bg-emerald-100 text-emerald-800", "envoyée"],
  [fileAttente.EN_ATTENTE]: ["bg-amber-100 text-amber-900", "en attente"],
  [fileAttente.ERREUR]: ["bg-rose-100 text-rose-900", "échec"],
};

function Ligne({ fiche, surRenvoi, surSuppression, surModification, envoiEnCours }) {
  const [couleur, texte] =
    fiche.etat === fileAttente.A_VERIFIER
      ? ["bg-sky-100 text-sky-900", "à vérifier"]
      : PASTILLES[fiche.etat] || PASTILLES[fileAttente.EN_ATTENTE];
  const modifiable =
    fiche.etat === fileAttente.A_VERIFIER ||
    (fiche.etat === fileAttente.EN_ATTENTE && !fiche.tentatives);
  return (
    <li className="rounded-2xl bg-white border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{resume(fiche.valeurs)}</p>
          <p className="text-xs text-slate-500">
            {(fiche.valeurs.analyses || []).length
              ? `${fiche.valeurs.analyses.length} analyse(s) : ${fiche.valeurs.analyses.join(", ")}`
              : "aucune analyse cochée"}
          </p>
          {fiche.envoye_le ? (
            <p className="text-xs text-emerald-700">
              envoyée le {new Date(fiche.envoye_le).toLocaleString("fr-CA")}
            </p>
          ) : null}
          {fiche.note ? <p className="text-xs text-amber-800 mt-1">{fiche.note}</p> : null}
          {fiche.erreur ? <p className="text-xs text-rose-700 mt-1">{fiche.erreur}</p> : null}
        </div>
        <span className={`shrink-0 text-xs rounded-full px-2 py-1 font-semibold ${couleur}`}>
          {texte}
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        {modifiable ? (
          <button
            type="button"
            className={BOUTON_PALE + " text-sm"}
            onClick={() => surModification(fiche)}
            disabled={envoiEnCours}
          >
            Modifier
          </button>
        ) : null}
        {fiche.etat !== fileAttente.ENVOYEE && fiche.etat !== fileAttente.A_VERIFIER ? (
          <button type="button" className={BOUTON_PALE + " text-sm"} onClick={() => surRenvoi(fiche)}>
            Remettre en attente
          </button>
        ) : null}
        <button
          type="button"
          className={BOUTON_PALE + " text-sm text-rose-700"}
          onClick={() => surSuppression(fiche)}
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}

export default function FileAttente({
  reglages,
  enLigne,
  envoiEnCours,
  dernierMessage,
  photos = [],
  surPhotos,
  surEnvoi,
  surModification,
  surChangement,
}) {
  const [fiches, setFiches] = useState([]);
  const [avis, setAvis] = useState("");

  const recharger = useCallback(async () => {
    setFiches(await fileAttente.toutes());
    if (surChangement) await surChangement();
  }, [surChangement]);

  useEffect(() => {
    recharger();
    // `envoiEnCours` et `dernierMessage` changent à la fin d'une tournée
    // d'envoi : c'est le moment où cette liste doit se relire.
  }, [recharger, envoiEnCours, dernierMessage]);

  const renvoyer = async (fiche) => {
    await fileAttente.majFiche(fiche.id, {
      etat: fileAttente.EN_ATTENTE,
      erreur: "",
      // LES TENTATIVES SONT REMISES À ZÉRO À LA MAIN, ET C'EST VOULU : la
      // vérification anti-doublon ne se déclenche qu'après une tentative. Un
      // renvoi demandé explicitement doit la garder ACTIVE, sinon un geste de
      // dépannage créerait la ligne en double qu'on cherche à éviter.
      tentatives: Math.max(1, fiche.tentatives || 1),
    });
    await recharger();
  };

  const supprimer = async (fiche) => {
    const quoi = resume(fiche.valeurs);
    if (
      !window.confirm(
        `Supprimer définitivement cette fiche de la tablette ?\n\n${quoi}\n\n${
          fiche.etat === fileAttente.ENVOYEE
            ? "Elle est déjà dans le fichier Excel : la supprimer ici ne l'enlève pas du fichier."
            : "ELLE N'A PAS ÉTÉ ENVOYÉE. La saisie sera perdue."
        }`
      )
    )
      return;
    await fileAttente.supprimer(fiche.id);
    await recharger();
  };

  const exporter = () => {
    if (!fiches.length) return;
    const groupes = repartirParAeroport(fiches);
    const maintenant = new Date();
    groupes.forEach(({ aeroport, fiches: groupe }) =>
      telecharger(csv(groupe, reglages), nomDuFichier(maintenant, aeroport))
    );
    setAvis(
      `${fiches.length} fiche(s) exportée(s) en ${groupes.length} fichier(s) CSV (${groupes
        .map((g) => g.aeroport)
        .join(", ")}).`
    );
  };

  // Excel (.xlsx) fabriqué dans le navigateur, puis téléchargé ou partagé.
  const exporterXlsx = async (partageAuSysteme) => {
    if (!fiches.length && !(partageAuSysteme && photos.length)) return;
    try {
      const groupes = fiches.length ? repartirParAeroport(fiches) : [];
      const maintenant = new Date();
      const fichiersExcel = await Promise.all(
        groupes.map(async ({ aeroport, fiches: groupe }) => {
          const nom = nomXlsx(nomDuFichier(maintenant, aeroport));
          return { blob: await classeur(groupe, reglages), nom };
        })
      );
      if (partageAuSysteme) {
        const fichiersPdf = [];
        for (const [type, photosDuType] of grouperPhotosParType(photos)) {
          fichiersPdf.push({
            blob: await creerPdfBordereaux(photosDuType),
            nom: nomPdf(type, photosDuType),
          });
        }
        const r = await partagerFichiers([...fichiersExcel, ...fichiersPdf]);
        if (r === "annule") return;
        const detailFichiers = [
          fichiersExcel.length ? `${fichiersExcel.length} fichier(s) Excel` : "",
          fichiersPdf.length ? `${fichiersPdf.length} fichier(s) PDF` : "",
        ]
          .filter(Boolean)
          .join(" et ");
        setAvis(
          r === "partage"
            ? `Fichiers transmis à la feuille de partage : ${detailFichiers}.`
            : `Fichiers téléchargés : ${detailFichiers} (le partage n'est pas offert ici).`
        );
      } else {
        fichiersExcel.forEach(({ blob, nom }) => telechargerBlob(blob, nom));
        setAvis(
          `${fiches.length} fiche(s) exportée(s) en ${fichiersExcel.length} fichier(s) Excel (${groupes
            .map((g) => g.aeroport)
            .join(", ")}).`
        );
      }
    } catch (e) {
      setAvis(`L'export Excel a échoué : ${e?.message || e}`);
    }
  };

  const nettoyer = async () => {
    const envoyees = fiches.filter((f) => f.etat === fileAttente.ENVOYEE).length;
    if (!envoyees) return;
    if (!window.confirm(`Retirer de la tablette les ${envoyees} fiche(s) déjà envoyées ?`)) return;
    await fileAttente.nettoyerEnvoyees();
    await recharger();
  };

  const attente = fiches.filter((f) => f.etat !== fileAttente.ENVOYEE).length;
  const aVerifier = fiches.filter((f) => f.etat === fileAttente.A_VERIFIER).length;
  const enAttente = attente - aVerifier;

  return (
    <div className="pb-24">
      <PhotosBordereau photos={photos} surPhotos={surPhotos} />
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
        <p className="text-sm text-slate-700">
          {fiches.length
            ? `${fiches.length} fiche(s) dans la tablette, dont ${aVerifier} à vérifier et ${enAttente} en attente d’envoi.`
            : "Aucune fiche enregistrée pour le moment."}
        </p>
        {aVerifier ? (
          <p className="mt-2 text-sm text-sky-900">
            Les fiches « à vérifier » ne sont pas partagées avant l’appui sur « Envoyer maintenant ».
          </p>
        ) : null}
        {!estRelie(reglages) ? (
          <p className="mt-2 text-sm text-amber-800">
            Le fichier Excel n'est pas encore relié : les fiches restent ici. Relie le fichier dans
            Réglages pour pouvoir les partager après vérification. Les exports CSV et Excel restent
            possibles.
          </p>
        ) : null}
        {!enLigne ? <p className="mt-2 text-sm text-amber-800">Hors ligne.</p> : null}
        {dernierMessage ? <p className="mt-2 text-sm text-slate-600">{dernierMessage}</p> : null}
        {avis ? <p className="mt-2 text-sm text-emerald-800">{avis}</p> : null}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            className={BOUTON}
            onClick={surEnvoi}
            disabled={!estRelie(reglages) || !attente || envoiEnCours || !enLigne}
          >
            {envoiEnCours ? "Envoi…" : "Envoyer maintenant"}
          </button>
          <button type="button" className={BOUTON_PALE} onClick={exporter} disabled={!fiches.length}>
            Exporter en CSV
          </button>
          <button type="button" className={BOUTON_PALE} onClick={() => exporterXlsx(false)} disabled={!fiches.length}>
            Exporter en Excel
          </button>
          <button
            type="button"
            className={BOUTON_PALE}
            onClick={() => exporterXlsx(true)}
            disabled={!fiches.length && !photos.length}
          >
            Partager
          </button>
          <button
            type="button"
            className={BOUTON_PALE}
            onClick={nettoyer}
            disabled={!fiches.some((f) => f.etat === fileAttente.ENVOYEE)}
          >
            Retirer les envoyées
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {[...fiches].reverse().map((fiche) => (
          // La plus RÉCENTE en haut : c'est celle qu'on vient de saisir, donc
          // celle qu'on veut relire. L'envoi, lui, respecte l'ordre de saisie.
          <Ligne
            key={fiche.id}
            fiche={fiche}
            surRenvoi={renvoyer}
            surSuppression={supprimer}
            surModification={surModification}
            envoiEnCours={envoiEnCours}
          />
        ))}
      </ul>
    </div>
  );
}
