/*
 * L'EXPORT EXCEL (.xlsx) ET LE PARTAGE — TOUT SE FAIT DANS LE NAVIGATEUR.
 *
 * Aucun appel réseau : le classeur est fabriqué sur la tablette, donc l'export
 * marche hors ligne comme le CSV. Les colonnes et les valeurs sont EXACTEMENT
 * celles du CSV (`tableau` de csv.js) : deux sorties qui diffèrent d'une
 * colonne feraient chercher un défaut là où il n'y a qu'une copie en retard.
 *
 * `exceljs` est importé À LA DEMANDE : il pèse environ 1 Mo et ne sert qu'au
 * geste d'export. Il reste précaché par le service worker (voir vite.config).
 */
import { tableau } from "./csv.js";
import { CHAMPS } from "../fiche/schema.js";

export const TYPE_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function classeur(fiches, reglages = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const { entetes, lignes, codes } = tableau(fiches, reglages);
  const colonnesNumeriques = new Set(CHAMPS.filter((c) => c.type === "nombre").map((c) => c.code));
  const wb = new ExcelJS.Workbook();
  const feuille = wb.addWorksheet("Fiches terrain");
  feuille.addRow(entetes);
  lignes.forEach((ligne) =>
    feuille.addRow(
      ligne.map((valeur, index) => {
        if (!colonnesNumeriques.has(codes[index]) || typeof valeur !== "string") return valeur;
        if (!/^-?\d+(?:[.,]\d+)?$/.test(valeur.trim())) return valeur;
        return Number(valeur.replace(",", "."));
      })
    )
  );
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: "frozen", ySplit: 1 }];
  entetes.forEach((e, i) => {
    const largeurs = [e.length, ...lignes.map((l) => String(l[i] ?? "").length)];
    feuille.getColumn(i + 1).width = Math.min(40, Math.max(10, ...largeurs) + 2);
    if (colonnesNumeriques.has(codes[i])) feuille.getColumn(i + 1).numFmt = "0.###############";
  });
  const octets = await wb.xlsx.writeBuffer();
  return new Blob([octets], { type: TYPE_XLSX });
}

export function nomXlsx(nomCsv) {
  return nomCsv.replace(/\.csv$/i, ".xlsx");
}

/** Téléchargement classique : la solution de repli du partage. */
export function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révoquée APRÈS le clic, jamais avant (voir csv.js).
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Partage le fichier par la feuille de partage du système (Web Share API,
 * avec fichier) quand elle existe ; sinon télécharge. Rend « partage »,
 * « telechargement » ou « annule » — l'écran dit alors la vérité à l'usager.
 */
export async function partager(blob, nom) {
  return partagerFichiers([{ blob, nom }]);
}

export async function partagerFichiers(fichiers) {
  const fichiersSysteme = fichiers.map(
    ({ blob, nom }) => new File([blob], nom, { type: blob.type })
  );
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: fichiersSysteme })
  ) {
    try {
      await navigator.share({
        files: fichiersSysteme,
        title: fichiersSysteme.map((f) => f.name).join(", "),
      });
      return "partage";
    } catch (e) {
      // Fermer la feuille de partage n'est pas une panne.
      if (e?.name === "AbortError") return "annule";
      // Toute autre erreur : on retombe sur le téléchargement.
    }
  }
  fichiers.forEach(({ blob, nom }) => telechargerBlob(blob, nom));
  return "telechargement";
}
