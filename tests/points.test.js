/*
 * LE RÉFÉRENTIEL DES POINTS.
 *
 * Trois choses à garantir : les listes livrées sont bien celles du
 * professionnel, un « -CQ » hérite de son point de base, et un collage ne
 * DÉTRUIT jamais une attribution déjà faite.
 */
import { describe, expect, it } from "vitest";
import {
  ajouter,
  analyserListe,
  baseDuCQ,
  comptePrefixe,
  fusionner,
  modifier,
  parPrefixe,
  pointsDe,
  pointsLivres,
  sansMatrice,
  supprimer,
  trouver,
  valeursDuPoint,
} from "../src/donnees/points.js";

const livres = pointsLivres();

describe("les listes livrées", () => {
  it("portent 62 points à YUL et 26 à YMX", () => {
    expect(pointsDe(livres, "YUL")).toHaveLength(62);
    expect(pointsDe(livres, "YMX")).toHaveLength(26);
  });

  it("gardent l'orthographe exacte, y compris les quasi-doublons fournis", () => {
    const yul = pointsDe(livres, "YUL").map((p) => p.id);
    // « B3 680 » et « B3-680 » sont tous deux dans la liste fournie : les
    // fusionner serait une décision qui ne nous appartient pas.
    expect(yul).toContain("B3 680");
    expect(yul).toContain("B3-680");
    expect(yul).toContain("Smith 1 Pré berme");
    expect(yul).toContain("Lave-auto SS1");
  });

  it("gardent « Sa1 » aux DEUX aéroports, sans le confondre", () => {
    expect(pointsDe(livres, "YUL").map((p) => p.id)).toContain("Sa1");
    expect(pointsDe(livres, "YMX").map((p) => p.id)).toContain("Sa1");
  });

  it("n'inventent AUCUNE matrice", () => {
    const avecMatrice = pointsDe(livres, "YUL").filter((p) => p.matrice);
    expect(avecMatrice).toEqual([]);
  });
});

describe("l'héritage des contrôles qualité", () => {
  it("reconnaît le point de base", () => {
    expect(baseDuCQ("B1-CQ")).toBe("B1");
    expect(baseDuCQ("B1B-CQ")).toBe("B1B");
    expect(baseDuCQ("P3B-CQ")).toBe("P3B");
    expect(baseDuCQ("B1")).toBeNull();
  });

  it("donne au « -CQ » la matrice de son point de base", () => {
    const points = modifier(livres, "YUL", "B1", { matrice: "Surface" });
    expect(valeursDuPoint(points, "YUL", "B1-CQ")).toEqual({ matrice: "Surface" });
    expect(trouver(points, "YUL", "B1-CQ").herite_de).toBe("B1");
  });

  it("ne rend rien quand le point de base n'a pas encore de matrice", () => {
    expect(valeursDuPoint(livres, "YUL", "B1-CQ")).toBeNull();
  });

  it("ne compte pas les « -CQ » parmi les points sans matrice", () => {
    const points = parPrefixe(livres, "YUL", "B", { matrice: "Surface" });
    expect(sansMatrice(points, "YUL").filter((p) => baseDuCQ(p.id))).toEqual([]);
  });
});

describe("l'attribution en lot", () => {
  it("compte avant d'agir", () => {
    // RP-5218, RP-30, RP-102, RP-133. « 24G-RP-102 » ne commence PAS par
    // « RP- » et n'est donc pas visé : un préfixe se lit au début du nom.
    expect(comptePrefixe(livres, "YUL", "RP-")).toBe(4);
  });

  it("n'attribue qu'aux points du bon préfixe", () => {
    const points = parPrefixe(livres, "YUL", "F06D", { matrice: "Surface" });
    const liste = pointsDe(points, "YUL");
    expect(liste.filter((p) => p.matrice === "Surface")).toHaveLength(6);
    expect(liste.find((p) => p.id === "B1").matrice).toBe("");
  });

  it("LAISSE LES « -CQ » DE CÔTÉ : ils héritent, et deux vérités vaudraient pire qu'une", () => {
    const points = parPrefixe(livres, "YUL", "B1", { matrice: "Surface" });
    expect(trouver(points, "YUL", "B1-CQ").matrice).toBe("Surface"); // par héritage
    expect(pointsDe(points, "YUL").find((p) => p.id === "B1-CQ").matrice).toBe(""); // pas en propre
  });

  it("ne fait rien sur un préfixe vide", () => {
    expect(parPrefixe(livres, "YUL", "   ", { matrice: "Boue" })).toBe(livres);
  });
});

describe("le collage d'une liste", () => {
  it("lit une colonne simple", () => {
    const { points } = analyserListe("B1\nB2\n\n  B3  ");
    expect(points.map((p) => p.id)).toEqual(["B1", "B2", "B3"]);
  });

  it("lit la matrice et la méthode, par tabulation ou point-virgule", () => {
    const { points } = analyserListe("RP-102 ; Pluvial ; Perche\nSa1\tSanitaire");
    expect(points[0]).toEqual({ id: "RP-102", matrice: "Pluvial", methode: "Perche" });
    expect(points[1]).toEqual({ id: "Sa1", matrice: "Sanitaire", methode: "" });
  });

  it("SIGNALE une valeur non reconnue plutôt que de la ranger au hasard", () => {
    const { points, refus } = analyserListe("B1 ; Pluvia");
    expect(points[0].matrice).toBe("");
    expect(refus).toEqual([{ ligne: 1, valeur: "Pluvia", id: "B1" }]);
  });

  it("ajoute les points neufs et complète les existants", () => {
    const { points, ajoutes, majs } = fusionner(livres, "YMX", [
      { id: "P1B", matrice: "Pluvial", methode: "" },
      { id: "Nouveau regard", matrice: "Boue", methode: "" },
    ]);
    expect(ajoutes).toBe(1);
    expect(majs).toBe(1);
    expect(pointsDe(points, "YMX").find((p) => p.id === "P1B").matrice).toBe("Pluvial");
  });

  it("N'EFFACE JAMAIS une matrice déjà attribuée avec une case vide", () => {
    const avant = modifier(livres, "YMX", "P1B", { matrice: "Pluvial" });
    const { points } = fusionner(avant, "YMX", [{ id: "P1B", matrice: "", methode: "" }]);
    expect(pointsDe(points, "YMX").find((p) => p.id === "P1B").matrice).toBe("Pluvial");
  });
});

describe("ajouter et retirer un point", () => {
  it("ajoute un point hors liste", () => {
    const points = ajouter(livres, "YMX", { id: "Regard neuf" });
    expect(pointsDe(points, "YMX")).toHaveLength(27);
  });

  it("refuse un doublon sans rien changer", () => {
    expect(ajouter(livres, "YMX", { id: "P1B" })).toBe(livres);
  });

  it("retire un point", () => {
    const points = supprimer(livres, "YMX", "Mirajet");
    expect(pointsDe(points, "YMX").map((p) => p.id)).not.toContain("Mirajet");
  });
});
