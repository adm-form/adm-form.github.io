/*
 * CE QUI SE REMPLIT TOUT SEUL, ET CE QU'ON NE RÉÉCRIT JAMAIS.
 *
 * Tout est pur ici : pas de React, pas de réseau, pas de stockage. C'est ce
 * qui permet de l'éprouver au complet dans `tests/regles.test.js` — la logique
 * de cette fiche est son seul vrai risque.
 *
 * LA RÈGLE QUI PORTE TOUT LE RESTE : UN CHAMP TOUCHÉ À LA MAIN N'EST JAMAIS
 * RÉÉCRIT. Sans elle, le technicien qui saisit un pH puis corrige l'aéroport
 * verrait sa mesure remplacée par « - » — une donnée relevée sur le terrain,
 * effacée par une automatisation, sans un mot. `touches` retient donc ce qui
 * vient de la main, et `auto` ce qui vient d'une déduction (pour l'afficher :
 * une valeur déduite doit se voir comme telle).
 */
import {
  CHAMPS,
  CHAMP_PAR_CODE,
  CHAMPS_PERSISTANTS,
  CHAMPS_PHYSICO,
  DEFAUTS_PAR_AEROPORT,
  NON_MESURE,
  REMPLI_PAR_LE_POINT,
  vide,
} from "./schema.js";

export function aujourdhui(maintenant = new Date()) {
  const d = (n) => String(n).padStart(2, "0");
  return `${maintenant.getFullYear()}-${d(maintenant.getMonth() + 1)}-${d(maintenant.getDate())}`;
}

export function maintenantHeure(maintenant = new Date()) {
  const d = (n) => String(n).padStart(2, "0");
  return `${d(maintenant.getHours())}:${d(maintenant.getMinutes())}`;
}

/* Un état de fiche : les valeurs, ce qui a été touché à la main, ce qui a été
 * déduit. `precedente` permet de reconduire les champs persistants. */
export function etatNeuf({ precedente = null, maintenant = new Date() } = {}) {
  const valeurs = {};
  for (const champ of CHAMPS) {
    valeurs[champ.code] = champ.type === "multi" ? [] : champ.defaut ?? "";
  }
  valeurs.date = aujourdhui(maintenant);
  valeurs.heure = maintenantHeure(maintenant);

  const touches = {};
  if (precedente) {
    for (const code of CHAMPS_PERSISTANTS) {
      if (vide(precedente.valeurs?.[code])) continue;
      valeurs[code] = precedente.valeurs[code];
      // Reconduit, donc assumé : on le marque touché pour qu'aucun défaut
      // d'aéroport ne vienne le réécrire derrière.
      if (precedente.touches?.[code]) touches[code] = true;
    }
  }

  let etat = { valeurs, touches, auto: {} };
  // L'aéroport reconduit doit reposer ses défaut « - » sur la fiche neuve,
  // sinon la deuxième fiche de la journée sortirait avec quatre cases vides
  // là où la première portait « - ».
  if (!vide(valeurs.aeroport)) {
    etat = { ...etat, ...appliquerAeroport(etat, valeurs.aeroport) };
  }
  return etat;
}

function appliquerAeroport({ valeurs, touches, auto }, aeroport) {
  const suite = { ...valeurs };
  const marques = { ...auto };
  const defauts = DEFAUTS_PAR_AEROPORT[aeroport] || {};
  for (const code of CHAMPS_PHYSICO) {
    if (touches[code]) continue; // saisi à la main : intouchable
    if (code in defauts) {
      suite[code] = defauts[code];
      marques[code] = "aeroport";
    } else if (marques[code] === "aeroport") {
      // On ne rend que ce qu'on a pris : passer de YUL à YMX doit effacer les
      // « - » que YUL avait posés, et RIEN d'autre.
      suite[code] = "";
      delete marques[code];
    }
  }
  return { valeurs: suite, auto: marques };
}

function appliquerPoint({ valeurs, touches, auto }, valeursDuPoint) {
  const suite = { ...valeurs };
  const marques = { ...auto };
  for (const code of REMPLI_PAR_LE_POINT) {
    if (touches[code]) continue;
    const valeur = valeursDuPoint?.[code];
    if (!vide(valeur)) {
      suite[code] = valeur;
      marques[code] = "point";
    } else if (marques[code] === "point") {
      suite[code] = "";
      delete marques[code];
    }
  }
  return { valeurs: suite, auto: marques };
}

/*
 * UN CHANGEMENT, ET SES CONSÉQUENCES.
 *
 * `valeursDuPoint` est fourni par l'appelant (il vient du référentiel, qui
 * vit dans la tablette) : cette fonction ne lit rien elle-même, ce qui la
 * rend éprouvable sans base ni navigateur.
 */
export function changer(etat, code, valeur, { valeursDuPoint = null } = {}) {
  let suivant = {
    valeurs: { ...etat.valeurs, [code]: valeur },
    touches: { ...etat.touches, [code]: true },
    auto: { ...etat.auto },
  };
  delete suivant.auto[code]; // une saisie à la main efface la marque « déduit »

  if (code === "aeroport") {
    suivant = { ...suivant, ...appliquerAeroport(suivant, valeur) };
    // Changer d'aéroport invalide le point : les listes sont distinctes, et
    // « Sa1 » existe aux DEUX aéroports sans désigner le même ouvrage. Garder
    // le point serait pire que le perdre.
    if (!vide(suivant.valeurs.point)) {
      suivant.valeurs = { ...suivant.valeurs, point: "", point_autre: "" };
      delete suivant.touches.point;
      delete suivant.touches.point_autre;
      suivant = { ...suivant, ...appliquerPoint(suivant, null) };
    }
  }

  if (code === "point") {
    suivant = { ...suivant, ...appliquerPoint(suivant, valeursDuPoint) };
    if (valeur !== "Autre" && !vide(suivant.valeurs.point_autre)) {
      suivant.valeurs = { ...suivant.valeurs, point_autre: "" };
      delete suivant.touches.point_autre;
    }
  }

  // Les dépendances qui s'effacent. On retire aussi la marque « touché » :
  // le champ redevenu invisible ne doit pas garder le souvenir d'une saisie
  // qui ne s'applique plus.
  if (code === "couleur" && valeur === "Aucune") {
    suivant.valeurs = { ...suivant.valeurs, couleur_intensite: "" };
    delete suivant.touches.couleur_intensite;
  }
  if (code === "odeur" && valeur === "Aucune") {
    suivant.valeurs = { ...suivant.valeurs, odeur_nature: "" };
    delete suivant.touches.odeur_nature;
  }

  return suivant;
}

export function visible(champ, valeurs) {
  const def = typeof champ === "string" ? CHAMP_PAR_CODE[champ] : champ;
  if (!def) return false;
  return def.condition ? Boolean(def.condition(valeurs)) : true;
}

export function champsVisibles(valeurs) {
  return CHAMPS.filter((c) => visible(c, valeurs));
}

/* Ce qui bloque l'enregistrement : un champ obligatoire, visible, et vide. */
export function manquants(valeurs) {
  return champsVisibles(valeurs)
    .filter((c) => c.obligatoire && vide(valeurs[c.code]))
    .map((c) => c.code);
}

export function nombreValide(texte) {
  if (vide(texte) || texte === NON_MESURE) return true;
  return /^-?\d+([.,]\d+)?$/.test(String(texte).trim());
}

export function enNombre(texte) {
  if (vide(texte) || texte === NON_MESURE) return null;
  const n = Number(String(texte).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/*
 * LES ANOMALIES AVERTISSENT, ELLES NE REFUSENT PAS.
 *
 * Un pH de 15 est très probablement une faute de frappe — mais un refus
 * bloquant, sur une tablette sous la pluie, fait saisir n'importe quoi pour
 * passer à l'écran suivant. On montre donc le doute et on laisse enregistrer.
 */
export function anomalies(valeurs) {
  const trouvees = [];
  for (const champ of champsVisibles(valeurs)) {
    if (champ.type !== "nombre") continue;
    const brut = valeurs[champ.code];
    if (vide(brut) || brut === NON_MESURE) continue;
    if (!nombreValide(brut)) {
      trouvees.push({ code: champ.code, message: `${champ.etiquette} : « ${brut} » n'est pas un nombre.` });
      continue;
    }
    const n = enNombre(brut);
    const [bas, haut] = champ.borne || [];
    if (bas !== undefined && (n < bas || n > haut)) {
      const unite = champ.unite ? ` ${champ.unite}` : "";
      trouvees.push({
        code: champ.code,
        message: `${champ.etiquette} : ${n}${unite} sort de l'intervalle habituel (${bas} à ${haut}).`,
      });
    }
  }
  return trouvees;
}

/* Le nom du point tel qu'il sera écrit : « Autre » est remplacé par la saisie. */
export function nomDuPoint(valeurs) {
  if (valeurs.point === "Autre") return String(valeurs.point_autre || "").trim();
  return valeurs.point || "";
}

/* Une ligne de résumé pour la file d'attente — ce que le technicien relit. */
export function resume(valeurs) {
  const morceaux = [valeurs.aeroport, nomDuPoint(valeurs), valeurs.matrice].filter(Boolean);
  const quand = [valeurs.date, valeurs.heure].filter(Boolean).join(" ");
  return [morceaux.join(" · "), quand].filter(Boolean).join(" — ");
}
