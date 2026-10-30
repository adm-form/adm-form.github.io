/*
 * LES POINTS D'ÉCHANTILLONNAGE — ET SURTOUT LEUR MATRICE.
 *
 * C'est ce qui fait que la fiche « se remplit toute seule » : un point qui
 * déclare sa matrice la pose dans la fiche dès qu'on le choisit.
 *
 * AUCUNE MATRICE N'EST DEVINÉE À PARTIR DU NOM DU POINT. « RP-102 » est très
 * probablement un regard pluvial, et « Sa1 » un sanitaire — mais une
 * supposition écrite dans un référentiel a l'air d'une donnée, et c'est
 * exactement ce sur quoi on finit par se fier. Les cases sont donc VIDES
 * jusqu'à ce que le professionnel les remplisse, et le compte des points
 * encore sans matrice est affiché en haut : il dit ce qui reste à faire.
 *
 * L'ATTRIBUTION EN LOT PAR PRÉFIXE est là pour que ce travail prenne cinq
 * minutes et non une heure : « tous les points qui commencent par RP- sont au
 * pluvial » est une phrase vérifiable d'un coup d'œil, alors que quatre-vingt-
 * huit choix un par un sont quatre-vingt-huit occasions de se tromper.
 */
import React, { useMemo, useState } from "react";
import { MATRICES } from "../fiche/schema.js";
import * as referentiel from "../donnees/points.js";

const METHODES = ["Perche", "Pompe péristaltique", "Manuelle", "Système", "Inspection visuelle seulement"];
const CARTE = "rounded-2xl bg-white border border-slate-200 p-4 mb-4";
const BOUTON = "cible px-4 rounded-xl font-semibold bg-teal-700 text-white active:bg-teal-800";
const BOUTON_PALE =
  "cible px-4 rounded-xl font-semibold bg-white border border-slate-300 text-slate-800 active:bg-slate-100";
const CHAMP =
  "w-full rounded-xl border border-slate-300 px-3 py-3 bg-white focus:border-teal-600 focus:outline-none";

function MiniMatrice({ point, surChoix }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MATRICES.map((m) => (
        <button
          key={m}
          type="button"
          className={`px-2 py-1.5 rounded-lg text-xs font-semibold border ${
            point.matrice === m
              ? "bg-teal-700 border-teal-700 text-white"
              : "bg-white border-slate-300 text-slate-700"
          }`}
          onClick={() => surChoix(point.matrice === m ? "" : m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default function Points({ points, surChangement }) {
  const [aeroport, setAeroport] = useState("YUL");
  const [filtre, setFiltre] = useState("");
  const [prefixe, setPrefixe] = useState("");
  const [matriceLot, setMatriceLot] = useState(MATRICES[1]);
  const [collage, setCollage] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [avis, setAvis] = useState("");

  const liste = referentiel.pointsDe(points, aeroport);
  const manquants = referentiel.sansMatrice(points, aeroport);
  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? liste.filter((p) => p.id.toLowerCase().includes(f)) : liste;
  }, [liste, filtre]);
  const vises = referentiel.comptePrefixe(points, aeroport, prefixe);

  const appliquerLot = () => {
    if (!vises) return;
    surChangement(referentiel.parPrefixe(points, aeroport, prefixe, { matrice: matriceLot }));
    setAvis(`${vises} point(s) commençant par « ${prefixe} » passés en « ${matriceLot} ».`);
  };

  const coller = () => {
    const { points: lus, refus } = referentiel.analyserListe(collage);
    if (!lus.length) {
      setAvis("Rien à lire dans ce collage.");
      return;
    }
    const { points: suite, ajoutes, majs } = referentiel.fusionner(points, aeroport, lus);
    surChangement(suite);
    setCollage("");
    setAvis(
      `${ajoutes} point(s) ajouté(s), ${majs} mis à jour.` +
        (refus.length
          ? ` ${refus.length} valeur(s) non reconnue(s) et IGNORÉE(S) : ${refus
              .slice(0, 5)
              .map((r) => `« ${r.valeur} » (ligne ${r.ligne})`)
              .join(", ")}.`
          : "")
    );
  };

  const ajouter = () => {
    const id = nouveau.trim();
    if (!id) return;
    const suite = referentiel.ajouter(points, aeroport, { id });
    if (suite === points) {
      setAvis(`« ${id} » est déjà dans la liste de ${aeroport}.`);
      return;
    }
    surChangement(suite);
    setNouveau("");
    setAvis(`« ${id} » ajouté à ${aeroport}.`);
  };

  const reinitialiser = () => {
    if (
      !window.confirm(
        "Revenir à la liste livrée avec l'application ? Les matrices attribuées sur cette tablette seront perdues."
      )
    )
      return;
    referentiel.oublier();
    surChangement(referentiel.pointsLivres());
    setAvis("Liste livrée rétablie.");
  };

  return (
    <div className="pb-24">
      <section className={CARTE}>
        <div className="flex gap-2 mb-3">
          {["YUL", "YMX"].map((a) => (
            <button
              key={a}
              type="button"
              className={`${a === aeroport ? BOUTON : BOUTON_PALE} flex-1`}
              onClick={() => setAeroport(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-700">
          {liste.length} point(s) à {aeroport}.{" "}
          {manquants.length ? (
            <span className="text-amber-800 font-semibold">
              {manquants.length} sans matrice — la fiche demandera de la choisir à la main.
            </span>
          ) : (
            <span className="text-emerald-700 font-semibold">Tous ont une matrice.</span>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Les points en « -CQ » n'ont pas de matrice propre : ils reprennent celle de leur point de
          base, un contrôle qualité étant prélevé au même endroit.
        </p>
        {avis ? <p className="mt-2 text-sm text-teal-800">{avis}</p> : null}
      </section>

      <section className={CARTE}>
        <h2 className="font-semibold mb-2">Attribuer une matrice en lot</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className={CHAMP + " flex-1 min-w-[8rem]"}
            value={prefixe}
            onChange={(e) => setPrefixe(e.target.value)}
            placeholder="Préfixe, par exemple RP-"
          />
          <select
            className={CHAMP + " w-auto"}
            value={matriceLot}
            onChange={(e) => setMatriceLot(e.target.value)}
          >
            {MATRICES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button type="button" className={BOUTON} onClick={appliquerLot} disabled={!vises}>
            Appliquer à {vises} point(s)
          </button>
        </div>
      </section>

      <section className={CARTE}>
        <h2 className="font-semibold mb-2">Coller une liste</h2>
        <p className="text-xs text-slate-500 mb-2">
          Une ligne par point. Avec une tabulation ou un point-virgule, on peut donner la matrice et
          la méthode : <code>RP-102 ; Pluvial ; Perche</code>. Une colonne vide n'EFFACE jamais une
          valeur déjà attribuée.
        </p>
        <textarea
          rows={4}
          className={CHAMP}
          value={collage}
          onChange={(e) => setCollage(e.target.value)}
          placeholder={"B1 ; Surface\nRP-102 ; Pluvial"}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" className={BOUTON} onClick={coller} disabled={!collage.trim()}>
            Ajouter / mettre à jour
          </button>
          <button type="button" className={BOUTON_PALE} onClick={reinitialiser}>
            Revenir à la liste livrée
          </button>
        </div>
      </section>

      <section className={CARTE}>
        <h2 className="font-semibold mb-2">Ajouter un point</h2>
        <div className="flex gap-2">
          <input
            className={CHAMP + " flex-1"}
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            placeholder={`Nom du point à ${aeroport}`}
          />
          <button type="button" className={BOUTON} onClick={ajouter} disabled={!nouveau.trim()}>
            Ajouter
          </button>
        </div>
      </section>

      <section className={CARTE}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Liste de {aeroport}</h2>
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer…"
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {visibles.map((p) => {
            const base = referentiel.baseDuCQ(p.id);
            const herite = base ? referentiel.trouver(points, aeroport, p.id) : null;
            return (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.id}</p>
                  {base ? (
                    <p className="text-xs text-slate-500">
                      {herite?.herite_de
                        ? `hérite de ${herite.herite_de} : ${herite.matrice || "sans matrice"}`
                        : `contrôle qualité de ${base} (qui n'a pas encore de matrice)`}
                    </p>
                  ) : null}
                </div>
                {base ? null : (
                  <div className="flex flex-wrap items-center gap-2">
                    <MiniMatrice
                      point={p}
                      surChoix={(m) =>
                        surChangement(referentiel.modifier(points, aeroport, p.id, { matrice: m }))
                      }
                    />
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      value={p.methode || ""}
                      onChange={(e) =>
                        surChangement(
                          referentiel.modifier(points, aeroport, p.id, { methode: e.target.value })
                        )
                      }
                    >
                      <option value="">méthode : au choix</option>
                      {METHODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
