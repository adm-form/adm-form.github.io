import { afterEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { tableau } from "../src/donnees/csv.js";
import { classeur, nomXlsx, partager, partagerFichiers, TYPE_XLSX } from "../src/donnees/xlsx.js";

const FICHES = [
  { id: 1, valeurs: { aeroport: "YUL", point: "Pt-1", remarques: "a;b \"c\"" } },
  { id: 2, valeurs: { aeroport: "YMX", point: "Pt-2" } },
];

describe("l'export Excel", () => {
  it("écrit les mêmes en-têtes et les mêmes lignes que le CSV", async () => {
    const { entetes, lignes } = tableau(FICHES, {});
    const blob = await classeur(FICHES, {});
    expect(blob.type).toBe(TYPE_XLSX);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const f = wb.worksheets[0];
    expect(f.rowCount).toBe(1 + FICHES.length);
    expect(f.getRow(1).values.slice(1)).toEqual(entetes);
    expect(f.getRow(2).values.slice(1).map((v) => v ?? "")).toEqual(lignes[0].map((v) => v ?? ""));
  });

  it("renomme .csv en .xlsx", () => {
    expect(nomXlsx("fiches-terrain-20261030-0900.csv")).toBe("fiches-terrain-20261030-0900.xlsx");
  });

  it("garde les mesures numériques et un format décimal régional", async () => {
    const fiche = {
      id: "decimal",
      valeurs: { aeroport: "YUL", temperature: "12,5" },
    };
    const blob = await classeur([fiche], {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const feuille = wb.worksheets[0];
    const colonneTemperature = feuille.getRow(1).values.indexOf("Température (°C)");
    expect(feuille.getCell(2, colonneTemperature).value).toBe(12.5);
    expect(feuille.getColumn(colonneTemperature).numFmt).toBe("0.###############");
  });
});

describe("le partage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passe par la Web Share API avec fichier quand elle existe", async () => {
    const appels = [];
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: async (d) => appels.push(d),
    });
    const r = await partager(new Blob(["x"], { type: TYPE_XLSX }), "f.xlsx");
    expect(r).toBe("partage");
    expect(appels[0].files[0].name).toBe("f.xlsx");
  });

  it("une feuille de partage fermée n'est pas une panne", async () => {
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); },
    });
    expect(await partager(new Blob(["x"]), "f.xlsx")).toBe("annule");
  });

  it("partage ensemble les fichiers de chaque aéroport", async () => {
    let partage;
    vi.stubGlobal("navigator", {
      canShare: ({ files }) => files.length === 2,
      share: async (contenu) => {
        partage = contenu;
      },
    });
    const r = await partagerFichiers([
      { blob: new Blob(["yul"], { type: TYPE_XLSX }), nom: "YUL.xlsx" },
      { blob: new Blob(["ymx"], { type: TYPE_XLSX }), nom: "YMX.xlsx" },
    ]);
    expect(r).toBe("partage");
    expect(partage.files.map((f) => f.name)).toEqual(["YUL.xlsx", "YMX.xlsx"]);
  });
});
