/*
 * LA FICHE TERRAIN.
 *
 * Elle ne décide de rien : tout ce qui se remplit tout seul vient de
 * `regles.js`, et tout ce qui s'affiche vient de `schema.js`. Cet écran
 * n'est qu'une mise en page — ce qui veut dire qu'une option ajoutée au
 * schéma apparaît ici sans qu'on y touche.
 *
 * ENREGISTRER D'ABORD, ENVOYER ENSUITE, TOUJOURS. Le bouton met la fiche dans
 * la file d'attente locale, puis TENTE l'envoi. Il ne reste jamais à attendre
 * le réseau : une fiche remplie est acquise au moment où on appuie, et c'est
 * la seule promesse qui tienne dans un hangar.
 */
import React, { useMemo, useState } from "react";
import { CHAMPS, SECTIONS } from "./schema.js";
import {
  anomalies,
  champsVisibles,
  changer,
  etatNeuf,
  manquants,
  nomDuPoint,
  nomEchantillon,
} from "./regles.js";
import { ChoixBoutons, ChoixMulti, ChoixPoint, DateOuHeure, Nombre, Texte } from "./champs.jsx";
import { pointsDe, valeursDuPoint, AUTRE } from "../donnees/points.js";
import * as fileAttente from "../donnees/file.js";

function Interieur({ champ, valeur, auto, probleme, onChange, points }) {
  const commun = { champ, valeur, auto, probleme, onChange };
  if (champ.type === "choix") return <ChoixBoutons {...commun} />;
  if (champ.type === "multi") return <ChoixMulti {...commun} />;
  if (champ.type === "nombre") return <Nombre {...commun} />;
  if (champ.type === "date" || champ.type === "heure") return <DateOuHeure {...commun} />;
  if (champ.type === "texte_long") return <Texte {...commun} long />;
  if (champ.type === "point") return <ChoixPoint {...commun} points={points} autre={AUTRE} />;
  return <Texte {...commun} />;
}

/*
 * `data-champ` N'EST PAS DE LA DÉCORATION : plusieurs champs portent les mêmes
 * options — « Aucune » est à la fois une couleur et une odeur, « Faible » à la
 * fois une odeur et un débit. Sans un repère par champ, ni un essai ni un
 * diagnostic ne peuvent désigner le bon bouton.
 */
function Champ({ champ, etat, points, onChange, probleme }) {
  return (
    <div data-champ={champ.code}>
      <Interieur
        champ={champ}
        valeur={etat.valeurs[champ.code]}
        auto={etat.auto[champ.code]}
        probleme={probleme}
        onChange={onChange}
        points={points}
      />
    </div>
  );
}

function etatDepuisFiche(fiche, points) {
  const valeurs = { ...etatNeuf().valeurs, ...fiche.valeurs };
  for (const code of ["couleur", "odeur"]) {
    if (valeurs[code] && !Array.isArray(valeurs[code])) valeurs[code] = [valeurs[code]];
  }
  const idsPoints = pointsDe(points, valeurs.aeroport).map((point) => point.id);
  if (valeurs.point && valeurs.point !== AUTRE && !idsPoints.includes(valeurs.point)) {
    valeurs.point_autre = valeurs.point_autre || valeurs.point;
    valeurs.point = AUTRE;
  }
  valeurs.nom_echantillon = valeurs.nom_echantillon || nomEchantillon(valeurs);
  const precedent = fiche.etatFormulaire;
  const touches =
    precedent?.touches ||
    Object.fromEntries(
      CHAMPS.filter((champ) => champ.code !== "nom_echantillon" && valeurs[champ.code]).map((champ) => [
        champ.code,
        true,
      ])
    );
  return { valeurs, touches, auto: precedent?.auto || {} };
}

export default function Formulaire({
  reglages,
  points,
  surEnregistrement,
  ficheInitiale = null,
  surAnnulation,
}) {
  const [etat, setEtat] = useState(() =>
    ficheInitiale ? etatDepuisFiche(ficheInitiale, points) : etatNeuf()
  );
  const [montrerManques, setMontrerManques] = useState(false);
  const [avis, setAvis] = useState(null);

  const aeroport = etat.valeurs.aeroport;
  const listePoints = useMemo(() => pointsDe(points, aeroport), [points, aeroport]);
  const visibles = champsVisibles(etat.valeurs);
  const manques = manquants(etat.valeurs);
  const alertes = anomalies(etat.valeurs);

  const modifier = (code, valeur) => {
    setEtat((precedent) =>
      changer(precedent, code, valeur, {
        valeursDuPoint:
          code === "point" ? valeursDuPoint(points, precedent.valeurs.aeroport, valeur) : null,
      })
    );
  };

  const enregistrer = async () => {
    if (manques.length) {
      setMontrerManques(true);
      setAvis({ genre: "refus", texte: "Des champs obligatoires sont vides." });
      return;
    }
    const valeurs = { ...etat.valeurs };
    const etatFormulaire = { touches: etat.touches, auto: etat.auto };
    const fiche = ficheInitiale
      ? await fileAttente.majFiche(ficheInitiale.id, {
          valeurs,
          etatFormulaire,
          etat: fileAttente.A_VERIFIER,
          erreur: "",
        })
      : await fileAttente.ajouter({
          ...fileAttente.ficheNeuve(valeurs),
          etat: fileAttente.A_VERIFIER,
          etatFormulaire,
        });
    if (!fiche) {
      setAvis({ genre: "refus", texte: "La fiche n’a pas pu être retrouvée pour la modification." });
      return;
    }
    setAvis({
      genre: "ok",
      texte: `Fiche enregistrée : ${fiche.valeurs.aeroport} · ${nomDuPoint(fiche.valeurs)}.`,
    });
    setMontrerManques(false);
    if (ficheInitiale) {
      if (surEnregistrement) await surEnregistrement(fiche);
      return;
    }
    // LA FICHE SUIVANTE GARDE L'AÉROPORT, LA CAMPAGNE, LE TECHNICIEN ET LA
    // DATE — et RIEN des observations : une odeur reportée d'un point à
    // l'autre serait une fausse donnée que personne ne pourrait détecter.
    setEtat((precedent) => etatNeuf({ precedente: precedent }));
    if (surEnregistrement) await surEnregistrement(fiche);
  };

  return (
    <div className="pb-28">
      {ficheInitiale ? (
        <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Modifie la fiche avant de la partager. Elle restera à vérifier jusqu’à l’envoi manuel.
        </p>
      ) : null}
      {avis ? (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            avis.genre === "ok"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          {avis.texte}
        </div>
      ) : null}

      {SECTIONS.map((section) => {
        const champsDeSection = visibles.filter((c) => c.section === section);
        if (!champsDeSection.length) return null;
        return (
          <section key={section} className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              {section}
            </h2>
            <div className="space-y-5 rounded-2xl bg-white border border-slate-200 p-4">
              {champsDeSection.map((champ) => {
                if (champ.type === "point" && !aeroport) {
                  return (
                    <p key={champ.code} className="text-sm text-slate-500">
                      Choisir l'aéroport pour voir ses points d'échantillonnage.
                    </p>
                  );
                }
                return (
                  <Champ
                    key={champ.code}
                    champ={champ}
                    etat={etat}
                    points={listePoints}
                    onChange={(v) => modifier(champ.code, v)}
                    // À CÔTÉ DU CHAMP, UN REPÈRE COURT ; LA PHRASE ENTIÈRE EST
                    // DANS LE RÉCAPITULATIF. Écrire les deux au même endroit
                    // affichait deux fois le même texte, ce qui fait chercher
                    // deux problèmes là où il n'y en a qu'un.
                    probleme={
                      montrerManques && manques.includes(champ.code)
                        ? "à remplir"
                        : alertes.some((a) => a.code === champ.code)
                          ? "à vérifier"
                          : undefined
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {/* LES ANOMALIES AVERTISSENT ET N'EMPÊCHENT RIEN : un pH de 15 est
          probablement une faute de frappe, mais un blocage sur une tablette
          sous la pluie fait saisir n'importe quoi pour passer à la suite. */}
      {alertes.length ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">À vérifier (l'enregistrement reste possible) :</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {alertes.map((a) => (
              <li key={a.code}>{a.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {montrerManques && manques.length ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          À remplir :{" "}
          {manques.map((code) => CHAMPS.find((c) => c.code === code)?.etiquette).join(", ")}
        </div>
      ) : null}

      {/* La barre d'enregistrement est FIXE et au-dessus de la navigation : sur
          une fiche de vingt champs, un bouton en bas de page demande de
          remonter pour vérifier puis redescendre pour appuyer. */}
      <div className="fixed left-0 right-0 bottom-16 zone-sure-bas cotes-surs bg-gradient-to-t from-slate-100 via-slate-100 to-transparent pt-3">
        {ficheInitiale ? (
          <button
            type="button"
            onClick={surAnnulation}
            className="w-full cible rounded-2xl bg-white border border-slate-300 text-slate-800 text-base font-semibold mb-2"
          >
            Annuler la modification
          </button>
        ) : null}
        <button
          type="button"
          onClick={enregistrer}
          className={`w-full cible rounded-2xl text-white text-lg font-semibold shadow-lg ${
            manques.length ? "bg-slate-400" : "bg-teal-700 active:bg-teal-800"
          }`}
        >
          {/* LE BOUTON DIT CE QU'IL VA FAIRE, OU CE QUI MANQUE. Il n'y a pas
              de troisième cas : le point étant obligatoire, une fiche sans
              point a toujours au moins un manque. */}
          {ficheInitiale
            ? manques.length
              ? `Enregistrer les modifications — ${manques.length} champ(s) à remplir`
              : `Enregistrer les modifications — ${nomDuPoint(etat.valeurs)}`
            : manques.length
              ? `Enregistrer — ${manques.length} champ(s) à remplir`
              : `Enregistrer — ${nomDuPoint(etat.valeurs)}`}
        </button>
      </div>
    </div>
  );
}
