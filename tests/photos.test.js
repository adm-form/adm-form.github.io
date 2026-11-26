import { describe, expect, it } from "vitest";
import { detecterBordereau } from "../src/donnees/photos.js";

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
});
