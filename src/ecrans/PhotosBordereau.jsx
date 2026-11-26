import React, { useEffect, useRef, useState } from "react";
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
  const svgRef = useRef(null);
  const coinActif = useRef("");

  useEffect(() => {
    let active = true;
    let urlLocale = "";
    setEnCours(true);
    setUrl("");
    setErreur("");
    recadrerPhoto(photo.source, photo.coins || photo.limites)
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
  }, [photo.source, photo.coins, photo.limites]);

  const coins = photo.coins || {
    hautGauche: { x: photo.limites.x, y: photo.limites.y },
    hautDroite: { x: photo.limites.x + photo.limites.largeur, y: photo.limites.y },
    basDroite: {
      x: photo.limites.x + photo.limites.largeur,
      y: photo.limites.y + photo.limites.hauteur,
    },
    basGauche: { x: photo.limites.x, y: photo.limites.y + photo.limites.hauteur },
  };

  const changerCoin = (nom, evenement) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (evenement.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (evenement.clientY - rect.top) / rect.height));
    surLimites(photo.id, {
      ...coins,
      [nom]: { x, y },
    });
  };

  const demarrerDeplacement = (nom, evenement) => {
    evenement.preventDefault();
    coinActif.current = nom;
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
  };

  const deplacerCoin = (evenement) => {
    if (!coinActif.current) return;
    changerCoin(coinActif.current, evenement);
  };

  const terminersDeplacement = (evenement) => {
    coinActif.current = "";
    if (evenement.currentTarget.hasPointerCapture?.(evenement.pointerId)) {
      evenement.currentTarget.releasePointerCapture(evenement.pointerId);
    }
  };

  const nomsCoins = ["hautGauche", "hautDroite", "basDroite", "basGauche"];
  const points = nomsCoins
    .map((nom) => `${coins[nom].x * 1000},${coins[nom].y * 1000}`)
    .join(" ");

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
      {photo.sourceUrl ? (
        <div className="relative mt-2 overflow-hidden rounded-lg bg-slate-100">
          <img
            className="block w-full"
            src={photo.sourceUrl}
            alt={`Photo originale de ${photo.nom}`}
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full touch-none"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-label={`Coins du bordereau — ${photo.nom}`}
            onPointerMove={deplacerCoin}
          >
            <polygon
              points={points}
              fill="rgba(13, 148, 136, 0.08)"
              stroke="#0d9488"
              strokeWidth="8"
              vectorEffect="non-scaling-stroke"
            />
            {nomsCoins.map((nom) => (
              <circle
                key={nom}
                cx={coins[nom].x * 1000}
                cy={coins[nom].y * 1000}
                r="24"
                fill="#fff"
                stroke="#0d9488"
                strokeWidth="8"
                vectorEffect="non-scaling-stroke"
                role="button"
                tabIndex="0"
                aria-label={`Coin ${nom}`}
                onPointerDown={(e) => demarrerDeplacement(nom, e)}
                onPointerUp={terminersDeplacement}
                onPointerCancel={terminersDeplacement}
              />
            ))}
          </svg>
        </div>
      ) : null}
      {url ? (
        <div className="mt-2">
          <p className="mb-1 text-xs text-slate-500">Aperçu du recadrage</p>
          <img
            className="max-h-64 w-full rounded-lg bg-slate-100 object-contain"
            src={url}
            alt={`Aperçu recadré de ${photo.nom}`}
          />
        </div>
      ) : null}
      {enCours ? <p className="mt-2 text-xs text-slate-500">Préparation de l’aperçu…</p> : null}
      {erreur ? <p className="mt-2 text-xs text-rose-700">{erreur}</p> : null}
      {!photo.detecte ? (
        <p className="mt-2 text-xs text-amber-800">
          Bordereau non détecté automatiquement. Déplacez les quatre coins avant le partage.
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Déplacez les quatre coins pour ajuster exactement les bords de la feuille.
        </p>
      )}
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
            sourceUrl: resultat.sourceUrl,
            limites: resultat.limites,
            coins: resultat.coins,
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

  const changerLimites = (id, coins) => {
    surPhotos((courantes) =>
      courantes.map((photo) => (photo.id === id ? { ...photo, coins } : photo))
    );
  };

  const retirer = (photo) => {
    if (photo.sourceUrl) URL.revokeObjectURL(photo.sourceUrl);
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
