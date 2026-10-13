/*
 * LES CHAMPS DE SAISIE, TAILLÉS POUR UN DOIGT GANTÉ.
 *
 * DES BOUTONS, PAS DES LISTES DÉROULANTES. Un menu déroulant demande deux
 * gestes précis (ouvrir, viser dans une liste qui défile) ; cinq boutons de
 * quarante-huit pixels en demandent un seul, et montrent toutes les options
 * d'un coup — ce qui vaut mieux quand on cherche « Verdâtre » parmi six
 * couleurs avec de la pluie sur l'écran.
 *
 * TOUS LES COMPOSANTS SONT DÉCLARÉS AU NIVEAU DU MODULE. Un composant défini
 * dans le corps d'un rendu est un TYPE NEUF à chaque frappe : React démonte le
 * champ et le remonte, et la saisie perd le focus lettre après lettre.
 */
import React, { useMemo, useState } from "react";
import { NON_MESURE } from "./schema.js";

const BOUTON_BASE =
  "cible px-4 rounded-xl border text-base font-medium transition-colors select-none";
const CHOISI = "bg-teal-700 border-teal-700 text-white shadow-sm";
const LIBRE = "bg-white border-slate-300 text-slate-800 active:bg-slate-100";

export function Etiquette({ champ, auto, probleme }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
      <span className="text-sm font-semibold text-slate-700">
        {champ.etiquette}
        {champ.unite ? <span className="font-normal text-slate-500"> ({champ.unite})</span> : null}
      </span>
      {champ.obligatoire ? <span className="text-rose-600 text-sm">obligatoire</span> : null}
      {/* UNE VALEUR DÉDUITE DOIT SE VOIR COMME TELLE : sans cette marque, le
          technicien ne sait pas s'il a choisi « Pluvial » ou si le référentiel
          l'a choisi pour lui — et ne sait donc pas s'il doit le vérifier. */}
      {auto === "point" ? (
        <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
          déduit du point
        </span>
      ) : null}
      {auto === "aeroport" ? (
        <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
          défaut de l'aéroport
        </span>
      ) : null}
      {probleme ? <span className="text-xs text-rose-600">{probleme}</span> : null}
      {champ.aide ? (
        <span className="block w-full text-xs text-slate-500">{champ.aide}</span>
      ) : null}
    </div>
  );
}

export function ChoixBoutons({ champ, valeur, auto, probleme, onChange }) {
  return (
    <div>
      <Etiquette champ={champ} auto={auto} probleme={probleme} />
      <div className="flex flex-wrap gap-2">
        {champ.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={valeur === option}
            className={`${BOUTON_BASE} ${valeur === option ? CHOISI : LIBRE}`}
            // Un deuxième appui sur l'option déjà choisie l'ANNULE, sauf si le
            // champ est obligatoire : sans cela, un choix posé par erreur sur
            // un champ facultatif ne peut plus être retiré.
            onClick={() => onChange(valeur === option && !champ.obligatoire ? "" : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChoixMulti({ champ, valeur, probleme, onChange }) {
  const choisies = Array.isArray(valeur) ? valeur : [];
  const basculer = (option) => {
    // L'ORDRE DES OPTIONS DU SCHÉMA EST CONSERVÉ, jamais l'ordre des appuis :
    // deux fiches avec les mêmes analyses doivent produire le même texte,
    // sinon le fichier Excel ne se trie ni ne se compte.
    const suite = choisies.includes(option)
      ? choisies.filter((c) => c !== option)
      : champ.options.filter((o) => o === option || choisies.includes(o));
    onChange(suite);
  };
  return (
    <div>
      <Etiquette champ={champ} probleme={probleme} />
      <div className="flex flex-wrap gap-2">
        {champ.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={choisies.includes(option)}
            className={`${BOUTON_BASE} ${choisies.includes(option) ? CHOISI : LIBRE}`}
            onClick={() => basculer(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {choisies.length ? (
        <p className="mt-2 text-xs text-slate-500">{choisies.length} analyse(s) : {choisies.join(", ")}</p>
      ) : null}
    </div>
  );
}

export function Texte({ champ, valeur, probleme, onChange, long = false }) {
  const commun = {
    value: valeur || "",
    onChange: (e) => onChange(e.target.value),
    className:
      "w-full rounded-xl border border-slate-300 px-3 py-3 bg-white text-slate-900 focus:border-teal-600 focus:outline-none",
  };
  return (
    <div>
      <Etiquette champ={champ} probleme={probleme} />
      {long ? <textarea rows={3} {...commun} /> : <input type="text" {...commun} />}
    </div>
  );
}

/*
 * UN NOMBRE, OU « NON MESURÉ » — ET LES DEUX NE SE CONFONDENT PAS.
 *
 * Une case vide est un OUBLI ; « - » est une DÉCISION (le paramètre n'est pas
 * relevé à cet aéroport). Les écrire de la même façon dans le fichier ferait
 * chercher une mesure qui n'a jamais été prévue.
 */
export function Nombre({ champ, valeur, auto, probleme, onChange }) {
  const nonMesure = valeur === NON_MESURE;
  return (
    <div>
      <Etiquette champ={champ} auto={auto} probleme={probleme} />
      <div className="flex gap-2">
        <input
          // `inputMode="decimal"` ouvre le pavé numérique de la tablette, avec
          // la virgule — et `type="text"` plutôt que `number`, dont les
          // flèches minuscules sont inutilisables au doigt et dont le
          // défilement de molette change la valeur par accident.
          type="text"
          inputMode="decimal"
          value={nonMesure ? "" : valeur || ""}
          placeholder={nonMesure ? "non mesuré" : ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-3 bg-white text-slate-900 focus:border-teal-600 focus:outline-none"
        />
        <button
          type="button"
          aria-pressed={nonMesure}
          className={`${BOUTON_BASE} ${nonMesure ? CHOISI : LIBRE} px-5`}
          onClick={() => onChange(nonMesure ? "" : NON_MESURE)}
          title="Paramètre non mesuré"
        >
          {NON_MESURE}
        </button>
      </div>
    </div>
  );
}

export function DateOuHeure({ champ, valeur, probleme, onChange }) {
  return (
    <div>
      <Etiquette champ={champ} probleme={probleme} />
      <input
        type={champ.type === "date" ? "date" : "time"}
        value={valeur || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-3 bg-white text-slate-900 focus:border-teal-600 focus:outline-none"
      />
    </div>
  );
}

/*
 * LE POINT D'ÉCHANTILLONNAGE — SOIXANTE-DEUX BOUTONS NE SE CHERCHENT PAS À
 * L'ŒIL.
 *
 * D'où le filtre : trois caractères suffisent à isoler « F24G-S3 ». La liste
 * reste affichée en entier au-dessous, dans L'ORDRE DU RÉFÉRENTIEL — celui
 * auquel le professionnel est habitué, et non un ordre alphabétique inventé
 * ici.
 *
 * LA MATRICE EST ÉCRITE SOUS CHAQUE POINT : c'est ce qui permet de voir, avant
 * de choisir, que ce point en porte une (donc que la fiche va se remplir) ou
 * qu'il n'en porte pas (donc qu'il faudra la saisir).
 */
export function ChoixPoint({ champ, valeur, probleme, points, onChange, autre = "Autre" }) {
  const [filtre, setFiltre] = useState("");
  const liste = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    if (!f) return points;
    return points.filter((p) => p.id.toLowerCase().includes(f));
  }, [points, filtre]);

  return (
    <div>
      <Etiquette champ={champ} probleme={probleme} />
      <input
        type="text"
        value={filtre}
        onChange={(e) => setFiltre(e.target.value)}
        placeholder={`Filtrer parmi ${points.length} point(s)…`}
        className="w-full mb-2 rounded-xl border border-slate-300 px-3 py-3 bg-white focus:border-teal-600 focus:outline-none"
      />
      <div className="liste-points max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="flex flex-wrap gap-2">
          {liste.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={valeur === p.id}
              className={`${BOUTON_BASE} ${valeur === p.id ? CHOISI : LIBRE} flex flex-col items-start justify-center py-1`}
              onClick={() => onChange(p.id)}
            >
              <span>{p.id}</span>
              {p.matrice ? (
                <span className={`text-xs ${valeur === p.id ? "text-teal-100" : "text-slate-500"}`}>
                  {p.matrice}
                </span>
              ) : null}
            </button>
          ))}
          {!liste.length ? (
            <p className="text-sm text-slate-500 px-2 py-3">
              Aucun point ne correspond. Choisir « {autre} » ci-dessous, ou ajouter le point dans
              l'écran Points.
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={valeur === autre}
        className={`${BOUTON_BASE} ${valeur === autre ? CHOISI : LIBRE} mt-2 w-full`}
        onClick={() => onChange(autre)}
      >
        {autre} — point hors liste
      </button>
    </div>
  );
}
