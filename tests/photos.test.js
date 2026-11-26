import { describe, expect, it } from "vitest";
import {
  detecterBordereau,
  grouperPhotosParType,
  nomPdf,
} from "../src/donnees/photos.js";
import { nomPhoto } from "../src/ecrans/PhotosBordereau.jsx";

function image(width, height, couleur = [35, 40, 45]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set([...couleur, 255], i * 4);
  }
  return { data, width, height };
}

describe("la détection du bordereau", () => {
  it("repère une feuille claire sur un fond sombre", () => {
    const photo = image(200, 150);
    for (let y = 20; y < 130; y++) {
      for (let x = 30; x < 170; x++) {
        photo.data.set([245, 245, 245, 255], (y * photo.width + x) * 4);
      }
    }

    const limites = detecterBordereau(photo);

    expect(limites.x).toBeCloseTo(0.14, 1);
    expect(limites.y).toBeCloseTo(0.13, 1);
    expect(limites.largeur).toBeCloseTo(0.72, 1);
    expect(limites.hauteur).toBeCloseTo(0.75, 1);
  });

  it("ne prétend pas détecter une feuille lorsque tout le fond est clair", () => {
    expect(detecterBordereau(image(100, 100, [245, 245, 245]))).toBeNull();
  });

  it("repère une feuille sur un fond bleu", () => {
    const photo = image(200, 150, [40, 80, 140]);
    for (let y = 20; y < 130; y++) {
      for (let x = 30; x < 170; x++) {
        photo.data.set([230, 228, 220, 255], (y * photo.width + x) * 4);
      }
    }

    const limites = detecterBordereau(photo);

    expect(limites).not.toBeNull();
    expect(limites.x).toBeCloseTo(0.14, 1);
    expect(limites.y).toBeCloseTo(0.13, 1);
  });

  it("réduit le cadre à la limite exacte au lieu d’ajouter une marge", () => {
    const photo = image(200, 150);
    for (let y = 20; y < 130; y++) {
      for (let x = 30; x < 170; x++) {
        photo.data.set([245, 245, 245, 255], (y * photo.width + x) * 4);
      }
    }

    const limites = detecterBordereau(photo);

    expect(limites.x).toBeCloseTo(0.15, 2);
    expect(limites.y).toBeCloseTo(0.1333, 2);
    expect(limites.largeur).toBeCloseTo(0.7, 2);
    expect(limites.hauteur).toBeCloseTo(0.7333, 2);
  });
});

describe("le nom des photos", () => {
  it("utilise uniquement l’aéroport, la date et un numéro lisible", () => {
    expect(nomPhoto("bordereau-YMX", "20261126T154201", 1))
      .toBe("bordereau-YMX-20261126T154201-01.jpg");
  });
});

describe("les PDF de bordereau", () => {
  it("groupe les photos du même type dans un même fichier", () => {
    const groupes = grouperPhotosParType([
      { nom: "bordereau-YMX-20261126T154201-01.jpg", type: "bordereau-YMX" },
      { nom: "bordereau-YMX-20261126T154201-02.jpg", type: "bordereau-YMX" },
      { nom: "bordereau-YUL-20261126T154201-01.jpg", type: "bordereau-YUL" },
    ]);

    expect(groupes.get("bordereau-YMX")).toHaveLength(2);
    expect(groupes.get("bordereau-YUL")).toHaveLength(1);
  });

  it("nomme le PDF avec son type et sa date", () => {
    expect(nomPdf("bordereau-YMX", [
      { nom: "bordereau-YMX-20261126T154201-01.jpg" },
    ])).toBe("bordereau-YMX-20261126T154201.pdf");
  });
});
