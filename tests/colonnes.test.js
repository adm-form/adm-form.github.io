/*
 * LA CORRESPONDANCE AVEC LES COLONNES DU FICHIER EXCEL.
 *
 * Deux défauts possibles, tous deux MUETS, et c'est pourquoi ce fichier
 * existe :
 *   - écrire une valeur dans la colonne du voisin (un pH dans « Débit ») ;
 *   - saisir un champ qui n'a nulle part où aller.
 * Ni l'un ni l'autre ne produit d'erreur : le fichier a l'air rempli.
 */
import { describe, expect, it } from "vitest";
import {
  COLONNES,
  ENTETES_DEFAUT,
  champsSansColonne,
  colonnePourEntete,
  controle,
  ligne,
  normaliser,
  perdues,
} from "../src/sharepoint/colonnes.js";
import { ANALYSES } from "../src/fiche/schema.js";

const FICHE = {
  id: "abc-123",
  cree_le: "2026-05-15T13:07:00.000Z",
  valeurs: {
    aeroport: "YMX",
    campagne: "Intensif",
    technicien: "S. Lessard",
    date: "2026-05-15",
    heure: "09:07",
    point: "P3A",
    matrice: "Pluvial",
    methode: "Perche",
    turbidite: "Trouble",
    couleur: "Verdâtre",
    couleur_intensite: "Légère",
    odeur: "Faible",
    odeur_nature: "Glycol",
    sediments: "Trace",
    debit: "Moyen",
    temperature: "12,4",
    oxygene_pct: "88",
    oxygene_mgl: "9,1",
    ph: "7,2",
    analyses: ["HP", "Glycol"],
    remarques: "Écoulement laiteux",
  },
};

describe("la normalisation des en-têtes", () => {
  it("ignore la casse, les accents et la ponctuation", () => {
    expect(normaliser("Aéroport")).toBe(normaliser("AEROPORT"));
    expect(normaliser("Point d'échantillonnage")).toBe(normaliser("point dechantillonnage"));
  });

  it("GARDE le sens du « % » : sans quoi les deux oxygènes se confondent", () => {
    // C'est le vrai piège : en retirant la ponctuation sans traduire le « % »,
    // « Oxygène dissous (%) » et « Oxygène dissous » deviennent identiques, et
    // une saturation part dans la colonne des mg/L.
    expect(normaliser("Oxygène dissous (%)")).not.toBe(normaliser("Oxygène dissous (mg/L)"));
    expect(colonnePourEntete("Oxygène dissous (%)").code).toBe("oxygene_pct");
    expect(colonnePourEntete("Oxygène dissous (mg/L)").code).toBe("oxygene_mgl");
  });

  it("ne confond pas « pH » et « HP »", () => {
    expect(colonnePourEntete("pH").code).toBe("ph");
    expect(colonnePourEntete("HP").code).toBe("analyse:HP");
  });
});

describe("les synonymes", () => {
  it("acceptent les titres qu'un fichier réel porte", () => {
    expect(colonnePourEntete("Site").code).toBe("aeroport");
    expect(colonnePourEntete("Station").code).toBe("point");
    expect(colonnePourEntete("OD (mg/L)").code).toBe("oxygene_mgl");
    expect(colonnePourEntete("Commentaires").code).toBe("remarques");
    expect(colonnePourEntete("Huiles et graisses").code).toBe("analyse:H&G");
  });

  it("rendent null sur une colonne étrangère", () => {
    expect(colonnePourEntete("N° de rapport du laboratoire")).toBeNull();
  });
});

describe("la ligne écrite", () => {
  it("suit l'ordre des colonnes DU FICHIER, pas le nôtre", () => {
    const entetes = ["Débit", "pH", "Aéroport"];
    expect(ligne(entetes, FICHE)).toEqual(["Moyen", "7,2", "YMX"]);
  });

  it("laisse une colonne inconnue à `null` — une chaîne vide EFFACERAIT sa formule", () => {
    const entetes = ["Aéroport", "Calcul du client", "pH"];
    const valeurs = ligne(entetes, FICHE);
    expect(valeurs[1]).toBeNull();
  });

  it("marque les analyses demandées, et seulement elles", () => {
    const entetes = ["Point d'échantillonnage", ...ANALYSES];
    const valeurs = ligne(entetes, FICHE, { marqueAnalyse: "X" });
    expect(valeurs[1 + ANALYSES.indexOf("HP")]).toBe("X");
    expect(valeurs[1 + ANALYSES.indexOf("Glycol")]).toBe("X");
    expect(valeurs[1 + ANALYSES.indexOf("BPC")]).toBe("");
  });

  it("sait aussi écrire les analyses dans une colonne unique", () => {
    expect(ligne(["Analyses effectuées"], FICHE)).toEqual(["HP, Glycol"]);
  });

  it("écrit le nom du point, jamais le mot « Autre »", () => {
    const hors = { ...FICHE, valeurs: { ...FICHE.valeurs, point: "Autre", point_autre: "Regard neuf" } };
    expect(ligne(["Point"], hors)).toEqual(["Regard neuf"]);
  });

  it("porte l'identifiant de la fiche, qui est ce qui permet de détecter un doublon", () => {
    expect(ligne(["Identifiant de la fiche"], FICHE)).toEqual(["abc-123"]);
  });
});

describe("le contrôle du fichier", () => {
  it("déclare prêt un tableau qui porte toutes les colonnes créées par défaut", () => {
    const c = controle(ENTETES_DEFAUT);
    expect(c.manquants).toEqual([]);
    expect(c.pret).toBe(true);
  });

  it("accepte une colonne unique d'analyses à la place des treize", () => {
    const entetes = ENTETES_DEFAUT.filter((e) => !ANALYSES.includes(e)).concat("Analyses effectuées");
    expect(controle(entetes).manquants).toEqual([]);
  });

  it("NOMME les champs qui n'ont pas de colonne : c'est la saisie perdue", () => {
    const entetes = ENTETES_DEFAUT.filter((e) => e !== "pH" && e !== "Débit");
    const c = controle(entetes);
    expect(c.manquants.map((m) => m.code).sort()).toEqual(["debit", "ph"]);
    expect(c.pret).toBe(false);
  });

  it("signale les colonnes étrangères SANS en faire un défaut", () => {
    const c = controle([...ENTETES_DEFAUT, "N° de rapport", "Résultat MES (mg/L)"]);
    expect(c.inconnues.map((i) => i.entete)).toEqual(["N° de rapport", "Résultat MES (mg/L)"]);
    expect(c.pret).toBe(true);
  });

  it("ne compte pas une colonne vide du fichier comme étrangère", () => {
    expect(controle(["Aéroport", "", "  "]).inconnues).toEqual([]);
  });
});

describe("ce qu'une fiche donnée perdrait", () => {
  it("ne liste que les champs REMPLIS sans colonne", () => {
    const perdus = perdues(["Aéroport", "Point d'échantillonnage"], FICHE);
    const codes = perdus.map((p) => p.code);
    expect(codes).toContain("ph");
    expect(codes).toContain("analyse:HP");
    expect(codes).not.toContain("analyse:BPC"); // non demandée : rien à perdre
    expect(codes).not.toContain("aeroport");
  });
});

describe("le garde-fou du schéma", () => {
  it("tout champ du formulaire a une colonne déclarée", () => {
    // Sans cet essai, un champ ajouté au formulaire et oublié dans
    // `colonnes.js` serait saisi par le technicien et jamais écrit — une
    // saisie perdue, sans la moindre erreur à l'écran.
    expect(champsSansColonne()).toEqual([]);
  });

  it("les en-têtes créés par défaut sont uniques", () => {
    expect(new Set(ENTETES_DEFAUT).size).toBe(ENTETES_DEFAUT.length);
  });

  it("la colonne unique d'analyses n'est PAS créée (une colonne par analyse se filtre)", () => {
    expect(ENTETES_DEFAUT).not.toContain("Analyses effectuées");
    expect(COLONNES.find((c) => c.code === "analyses").creer).toBe(false);
  });
});
