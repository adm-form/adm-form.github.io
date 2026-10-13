/*
 * CE QUI SE REMPLIT TOUT SEUL EST CE QUI PEUT TROMPER : d'où ces essais.
 *
 * Le cas qui compte le plus est le DERNIER d'une série : une valeur saisie à
 * la main ne doit JAMAIS être réécrite par une automatisation. Un défaut de
 * ce genre efface une mesure prise sur le terrain, en silence, et personne ne
 * s'en aperçoit avant d'interpréter les résultats.
 */
import { describe, expect, it } from "vitest";
import { changer, etatNeuf, manquants, anomalies, nomDuPoint, resume, visible } from "../src/fiche/regles.js";
import { NON_MESURE } from "../src/fiche/schema.js";

const LE_15_MAI = new Date(2026, 4, 15, 9, 7);

describe("la fiche neuve", () => {
  it("porte les défauts demandés", () => {
    const { valeurs } = etatNeuf({ maintenant: LE_15_MAI });
    expect(valeurs.campagne).toBe("Régulier");
    expect(valeurs.technicien).toBe("S. Lessard");
    expect(valeurs.date).toBe("2026-05-15");
    expect(valeurs.heure).toBe("09:07");
    expect(valeurs.analyses).toEqual([]);
  });

  it("n'impose AUCUN aéroport : le deviner déciderait du « - » à notre place", () => {
    expect(etatNeuf().valeurs.aeroport).toBe("");
  });
});

describe("le « - » de YUL", () => {
  it("passe les quatre paramètres physico-chimiques en « non mesuré »", () => {
    const etat = changer(etatNeuf(), "aeroport", "YUL");
    expect(etat.valeurs.temperature).toBe(NON_MESURE);
    expect(etat.valeurs.oxygene_pct).toBe(NON_MESURE);
    expect(etat.valeurs.oxygene_mgl).toBe(NON_MESURE);
    expect(etat.valeurs.ph).toBe(NON_MESURE);
  });

  it("les marque « défaut de l'aéroport », pour qu'ils se voient comme déduits", () => {
    const etat = changer(etatNeuf(), "aeroport", "YUL");
    expect(etat.auto.ph).toBe("aeroport");
  });

  it("laisse les champs VIDES à YMX", () => {
    const etat = changer(etatNeuf(), "aeroport", "YMX");
    expect(etat.valeurs.ph).toBe("");
    expect(etat.auto.ph).toBeUndefined();
  });

  it("retire ses « - » quand on corrige YUL en YMX — et seulement les siens", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "aeroport", "YMX");
    expect(etat.valeurs.temperature).toBe("");
    expect(etat.valeurs.ph).toBe("");
  });

  it("N'ÉCRASE JAMAIS une valeur saisie à la main", () => {
    let etat = changer(etatNeuf(), "aeroport", "YMX");
    etat = changer(etat, "ph", "7,2");
    etat = changer(etat, "aeroport", "YUL"); // le technicien corrige l'aéroport
    expect(etat.valeurs.ph).toBe("7,2"); // la mesure survit
    expect(etat.valeurs.temperature).toBe(NON_MESURE); // les autres prennent le défaut
  });

  it("reconduit le « - » sur la fiche suivante de la même journée", () => {
    const premiere = changer(etatNeuf(), "aeroport", "YUL");
    const suivante = etatNeuf({ precedente: premiere });
    expect(suivante.valeurs.aeroport).toBe("YUL");
    expect(suivante.valeurs.ph).toBe(NON_MESURE);
  });
});

describe("ce qui survit d'une fiche à l'autre", () => {
  it("garde l'aéroport, la campagne, le technicien et la date", () => {
    let etat = changer(etatNeuf({ maintenant: LE_15_MAI }), "aeroport", "YMX");
    etat = changer(etat, "technicien", "M. Tremblay");
    etat = changer(etat, "campagne", "Intensif");
    const suivante = etatNeuf({ precedente: etat });
    expect(suivante.valeurs.technicien).toBe("M. Tremblay");
    expect(suivante.valeurs.campagne).toBe("Intensif");
    expect(suivante.valeurs.aeroport).toBe("YMX");
  });

  it("ne garde AUCUNE observation : une odeur reportée serait une fausse donnée", () => {
    let etat = changer(etatNeuf(), "aeroport", "YMX");
    etat = changer(etat, "odeur", "Forte");
    etat = changer(etat, "odeur_nature", "Glycol");
    etat = changer(etat, "turbidite", "Opaque");
    etat = changer(etat, "analyses", ["HP", "Glycol"]);
    const suivante = etatNeuf({ precedente: etat });
    expect(suivante.valeurs.odeur).toBe("");
    expect(suivante.valeurs.odeur_nature).toBe("");
    expect(suivante.valeurs.turbidite).toBe("");
    expect(suivante.valeurs.analyses).toEqual([]);
  });
});

describe("le point d'échantillonnage", () => {
  it("remplit la matrice déclarée par le point", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "RP-102", { valeursDuPoint: { matrice: "Pluvial" } });
    expect(etat.valeurs.matrice).toBe("Pluvial");
    expect(etat.auto.matrice).toBe("point");
  });

  it("remplace la matrice déduite quand on change de point", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "RP-102", { valeursDuPoint: { matrice: "Pluvial" } });
    etat = changer(etat, "point", "Sa1", { valeursDuPoint: { matrice: "Sanitaire" } });
    expect(etat.valeurs.matrice).toBe("Sanitaire");
  });

  it("vide la matrice déduite quand le nouveau point n'en déclare pas", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "RP-102", { valeursDuPoint: { matrice: "Pluvial" } });
    etat = changer(etat, "point", "B9", { valeursDuPoint: null });
    expect(etat.valeurs.matrice).toBe("");
  });

  it("respecte une matrice corrigée à la main, même en changeant de point", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "RP-102", { valeursDuPoint: { matrice: "Pluvial" } });
    etat = changer(etat, "matrice", "Boue");
    etat = changer(etat, "point", "Sa1", { valeursDuPoint: { matrice: "Sanitaire" } });
    expect(etat.valeurs.matrice).toBe("Boue");
  });

  it("OUBLIE LE POINT quand l'aéroport change : « Sa1 » existe aux deux", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "Sa1", { valeursDuPoint: { matrice: "Sanitaire" } });
    etat = changer(etat, "aeroport", "YMX");
    expect(etat.valeurs.point).toBe("");
    expect(etat.valeurs.matrice).toBe("");
  });

  it("écrit le nom saisi, jamais le mot « Autre »", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "Autre");
    etat = changer(etat, "point_autre", "Regard neuf côté 06D");
    expect(nomDuPoint(etat.valeurs)).toBe("Regard neuf côté 06D");
  });

  it("efface le nom libre si on revient à un point de la liste", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "Autre");
    etat = changer(etat, "point_autre", "Regard neuf");
    etat = changer(etat, "point", "B1");
    expect(etat.valeurs.point_autre).toBe("");
  });
});

describe("les dépendances d'affichage", () => {
  it("cache l'intensité tant qu'aucune couleur n'est choisie", () => {
    const { valeurs } = etatNeuf();
    expect(visible("couleur_intensite", valeurs)).toBe(false);
  });

  it("montre l'intensité dès qu'une couleur est choisie", () => {
    const etat = changer(etatNeuf(), "couleur", "Verdâtre");
    expect(visible("couleur_intensite", etat.valeurs)).toBe(true);
  });

  it("efface l'intensité quand la couleur repasse à « Aucune »", () => {
    let etat = changer(etatNeuf(), "couleur", "Verdâtre");
    etat = changer(etat, "couleur_intensite", "Intense");
    etat = changer(etat, "couleur", "Aucune");
    expect(etat.valeurs.couleur_intensite).toBe("");
    expect(visible("couleur_intensite", etat.valeurs)).toBe(false);
  });

  it("efface la nature de l'odeur quand l'odeur repasse à « Aucune »", () => {
    let etat = changer(etatNeuf(), "odeur", "Moyenne");
    etat = changer(etat, "odeur_nature", "Hydrocarbures");
    etat = changer(etat, "odeur", "Aucune");
    expect(etat.valeurs.odeur_nature).toBe("");
  });
});

describe("ce qui bloque l'enregistrement", () => {
  it("réclame l'aéroport, le point, la matrice et la méthode", () => {
    const { valeurs } = etatNeuf();
    expect(manquants(valeurs)).toEqual(
      expect.arrayContaining(["aeroport", "point", "matrice", "methode"])
    );
  });

  it("ne réclame rien d'une fiche complète", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "B1", { valeursDuPoint: { matrice: "Surface" } });
    etat = changer(etat, "methode", "Perche");
    expect(manquants(etat.valeurs)).toEqual([]);
  });

  it("réclame le nom libre quand le point est « Autre »", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "Autre");
    etat = changer(etat, "matrice", "Surface");
    etat = changer(etat, "methode", "Perche");
    expect(manquants(etat.valeurs)).toEqual(["point_autre"]);
  });

  it("ne réclame JAMAIS une observation : une fiche incomplète vaut mieux qu'une fausse", () => {
    let etat = changer(etatNeuf(), "aeroport", "YUL");
    etat = changer(etat, "point", "B1", { valeursDuPoint: { matrice: "Surface" } });
    etat = changer(etat, "methode", "Manuelle");
    const reclames = manquants(etat.valeurs);
    for (const code of ["turbidite", "couleur", "odeur", "sediments", "debit", "analyses"]) {
      expect(reclames).not.toContain(code);
    }
  });
});

describe("les anomalies avertissent sans bloquer", () => {
  it("signale un pH hors de 0 à 14", () => {
    const etat = changer(etatNeuf(), "ph", "15,2");
    expect(anomalies(etat.valeurs)).toHaveLength(1);
    expect(manquants(etat.valeurs)).not.toContain("ph");
  });

  it("accepte la virgule décimale", () => {
    const etat = changer(etatNeuf(), "ph", "7,15");
    expect(anomalies(etat.valeurs)).toEqual([]);
  });

  it("signale un texte dans un champ numérique", () => {
    const etat = changer(etatNeuf(), "temperature", "douze");
    expect(anomalies(etat.valeurs)[0].message).toContain("n'est pas un nombre");
  });

  it("ne signale rien pour « - »", () => {
    const etat = changer(etatNeuf(), "aeroport", "YUL");
    expect(anomalies(etat.valeurs)).toEqual([]);
  });
});

describe("le résumé relu dans la file d'attente", () => {
  it("nomme l'aéroport, le point, la matrice et le moment", () => {
    let etat = changer(etatNeuf({ maintenant: LE_15_MAI }), "aeroport", "YMX");
    etat = changer(etat, "point", "P3A", { valeursDuPoint: { matrice: "Pluvial" } });
    expect(resume(etat.valeurs)).toBe("YMX · P3A · Pluvial — 2026-05-15 09:07");
  });
});
