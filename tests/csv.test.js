/*
 * L'EXPORT CSV — la sortie de secours. Deux détails la rendent utilisable ou
 * inutilisable dans Excel en français, et aucun des deux ne lève d'erreur :
 * le point-virgule et le BOM.
 */
import { describe, expect, it } from "vitest";
import { csv, echapper, nomDuFichier } from "../src/donnees/csv.js";

const FICHE = {
  id: "abc-123",
  cree_le: "2026-05-15T13:07:00.000Z",
  valeurs: {
    aeroport: "YUL",
    point: "B1",
    matrice: "Surface",
    ph: "-",
    analyses: ["HP", "MES"],
    remarques: "Eau claire, aucun débit",
  },
};

// Le découpage naïf sur « ; » ci-dessous ne vaut que parce qu'aucune valeur de
// cette fiche n'en contient : un point-virgule dans les remarques est protégé
// par des guillemets (voir l'essai « protège un point-virgule »), et casserait
// l'alignement des colonnes de ce test — pas celui du fichier.
const colonnesEtValeurs = (fiche) => {
  const [entete, premiere] = csv([fiche]).replace("﻿", "").split("\r\n");
  return { colonnes: entete.split(";"), valeurs: premiere.split(";") };
};

describe("le fichier produit", () => {
  it("commence par le BOM UTF-8, sans quoi Excel abîme les accents", () => {
    expect(csv([FICHE]).startsWith("﻿")).toBe(true);
  });

  it("sépare par des points-virgules, sans quoi tout tombe dans une colonne", () => {
    const [entete] = csv([FICHE]).replace("﻿", "").split("\r\n");
    expect(entete.split(";").length).toBeGreaterThan(20);
    expect(entete).toContain("Aéroport");
  });

  it("porte une ligne d'en-tête et une ligne par fiche", () => {
    const lignes = csv([FICHE, FICHE]).trim().split("\r\n");
    expect(lignes).toHaveLength(3);
  });

  it("marque les analyses demandées dans leur colonne", () => {
    const { colonnes, valeurs } = colonnesEtValeurs(FICHE);
    expect(valeurs[colonnes.indexOf("HP")]).toBe("X");
    expect(valeurs[colonnes.indexOf("MES")]).toBe("X");
    expect(valeurs[colonnes.indexOf("BPC")]).toBe("");
  });

  it("garde le « - » d'un paramètre non mesuré", () => {
    const { colonnes, valeurs } = colonnesEtValeurs(FICHE);
    expect(valeurs[colonnes.indexOf("pH")]).toBe("-");
  });

  it("protège un point-virgule contenu dans les remarques", () => {
    const avecPointVirgule = {
      ...FICHE,
      valeurs: { ...FICHE.valeurs, remarques: "Eau claire ; aucun débit" },
    };
    expect(csv([avecPointVirgule])).toContain('"Eau claire ; aucun débit"');
  });
});

describe("l'échappement", () => {
  it("protège un point-virgule contenu dans une remarque", () => {
    expect(echapper("Eau claire ; aucun débit")).toBe('"Eau claire ; aucun débit"');
  });

  it("double les guillemets", () => {
    expect(echapper('il a dit "non"')).toBe('"il a dit ""non"""');
  });

  it("protège un saut de ligne", () => {
    expect(echapper("deux\nlignes")).toBe('"deux\nlignes"');
  });

  it("laisse un texte simple tel quel", () => {
    expect(echapper("Surface")).toBe("Surface");
  });
});

describe("le nom du fichier", () => {
  it("porte la date et l'heure, pour que deux exports ne se recouvrent pas", () => {
    expect(nomDuFichier(new Date(2026, 4, 15, 9, 7))).toBe("fiches-terrain-20260515-0907.csv");
  });
});
