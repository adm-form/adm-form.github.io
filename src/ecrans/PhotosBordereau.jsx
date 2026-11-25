import React, { useEffect, useState } from "react";
import { analyserPhoto, recadrerPhoto } from "../donnees/photos.js";

const TYPES = [
  { titre: "Photo bordereau YUL", nom: "bordereau-YUL" },
  { titre: "Bordereau YUL-B1B", nom: "bordereau-YUL-B1B" },
  { titre: "Bordereau YMX", nom: "bordereau-YMX" },
];

let numeroPhoto = 0;

function identifiantPhoto() {
  numeroPhoto += 1;
  return `${Date.now().toString(36)}-${numeroPhoto}`;
}

function Photo({ photo, surLimites, surRetrait }) {
  const [url, setUrl] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let active = true;
    let urlLocale = "";
    setEnCours(true);
    setUrl("");
    setErreur("");
    recadrerPhoto(photo.source, photo.limites)
      .then((blob) => {
        if (!active) return;
        urlLocale = URL.createObjectURL(blob);
        setUrl(urlLocale);
      })
      .catch((e) => {
        if (active) setErreur(e.message);
      })
      .finally(() => {
        if (active) setEnCours(false);
      });
    return () => {
      active = false;
      if (urlLocale) URL.revokeObjectURL(urlLocale);
    };
  }, [photo.source, photo.limites]);

  const changer = (bord, valeur) => {
    const l = photo.limites;
    const min = 0.08;
    const gauche = bord === "gauche" ? Math.min(valeur, l.x + l.largeur - min) : l.x;
    const haut = bord === "haut" ? Math.min(valeur, l.y + l.hauteur - min) : l.y;
    const droite =
      bord === "droite"
        ? Math.max(valeur, l.x + min)
        : l.x + l.largeur;
    const bas =
      bord === "bas"
        ? Math.max(valeur, l.y + min)
        : l.y + l.hauteur;
    surLimites(photo.id, {
      x: gauche,
      y: haut,
      largeur: Math.min(1, droite) - gauche,
      hauteur: Math.min(1, bas) - haut,
    });
  };

  const curseur = (titre, bord, valeur) => (
    <label className="block text-xs text-slate-600">
      <span className="flex justify-between">
        <span>{titre}</span>
        <span>{Math.round(valeur * 100)} %</span>
      </span>
      <input
        className="w-full"
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(valeur * 100)}
        onChange={(e) => changer(bord, Number(e.target.value) / 100)}
        aria-label={`${titre} — ${photo.nom}`}
      />
    </label>
  );

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-all text-sm font-medium">{photo.nom}</p>
        <button
          type="button"
          className="cible shrink-0 rounded-lg px-3 text-sm text-rose-700"
          onClick={() => surRetrait(photo)}
          aria-label={`Retirer ${photo.nom}`}
        >
          Retirer
        </button>
      </div>
      {url ? (
        <img
          className="mt-2 max-h-64 w-full rounded-lg bg-slate-100 object-contain"
          src={url}
          alt={`Aperçu recadré de ${photo.nom}`}
        />
      ) : null}
      {enCours ? <p className="mt-2 text-xs text-slate-500">Préparation de l’aperçu…</p> : null}
      {erreur ? <p className="mt-2 text-xs text-rose-700">{erreur}</p> : null}
      {!photo.detecte ? (
        <p className="mt-2 text-xs text-amber-800">
          Bordereau non détecté automatiquement. Ajustez le cadre avant le partage.
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Vérifiez l’aperçu et ajustez le cadre si nécessaire.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {curseur("Gauche", "gauche", photo.limites.x)}
        {curseur("Droite", "droite", photo.limites.x + photo.limites.largeur)}
        {curseur("Haut", "haut", photo.limites.y)}
        {curseur("Bas", "bas", photo.limites.y + photo.limites.hauteur)}
      </div>
    </li>
  );
}

export default function PhotosBordereau({ photos, surPhotos }) {
  const [avis, setAvis] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);

  const ajouter = async (type, fichiers) => {
    const erreurs = [];
    setAnalyseEnCours(true);
    let ajoutes = 0;
    for (const fichier of fichiers) {
      if (!fichier.type.startsWith("image/")) {
        erreurs.push(`« ${fichier.name} » n’est pas une image.`);
        continue;
      }
      try {
        const resultat = await analyserPhoto(fichier);
        const date = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
        const id = identifiantPhoto();
        surPhotos((courants) => [
          ...courants,
          {
            id,
            nom: `${type.nom}-${date}-${id}.jpg`,
            source: resultat.source,
            limites: resultat.limites,
            detecte: resultat.detecte,
          },
        ]);
        ajoutes += 1;
      } catch (e) {
        erreurs.push(`Impossible de traiter « ${fichier.name} » : ${e.message}`);
      }
    }
    if (ajoutes) erreurs.unshift(`${ajoutes} photo(s) ajoutée(s).`);
    setAvis(erreurs.join(" "));
    setAnalyseEnCours(false);
  };

  const changerLimites = (id, limites) => {
    surPhotos((courantes) =>
      courantes.map((photo) => (photo.id === id ? { ...photo, limites } : photo))
    );
  };

  const retirer = (photo) => {
    photo.source.close();
    surPhotos((courantes) => courantes.filter((courante) => courante.id !== photo.id));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
      <h2 className="font-semibold text-slate-900">Photos de bordereau</h2>
      <p className="mt-1 text-sm text-slate-600">
        Ajoutez une ou plusieurs photos. Elles seront jointes au bouton « Partager » avec les
        fichiers Excel; « Envoyer maintenant » n’envoie que les lignes du classeur. Les photos
        restent dans cette session de l’application.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {TYPES.map((type) => (
          <label
            key={type.titre}
            className="cible flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 px-3 text-center text-sm font-semibold text-slate-800"
          >
            {type.titre}
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={analyseEnCours}
              aria-label={type.titre}
              onChange={(e) => {
                const fichiers = Array.from(e.currentTarget.files || []);
                e.currentTarget.value = "";
                if (fichiers.length) ajouter(type, fichiers);
              }}
            />
          </label>
        ))}
      </div>
      {analyseEnCours ? (
        <p className="mt-2 text-sm text-slate-600">Analyse des photos…</p>
      ) : null}
      {avis ? <p className="mt-2 text-sm text-slate-700" role="status">{avis}</p> : null}
      {photos.length ? (
        <ul className="mt-3 space-y-3">
          {photos.map((photo) => (
            <Photo
              key={photo.id}
              photo={photo}
              surLimites={changerLimites}
              surRetrait={retirer}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
