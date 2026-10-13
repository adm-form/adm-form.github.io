/*
 * LES PARTIES PURES DE LA COUCHE MICROSOFT GRAPH.
 *
 * On n'essaie PAS le réseau ici (il faudrait un vrai locataire Microsoft).
 * Mais trois calculs peuvent être faux en silence, et ceux-là s'éprouvent :
 * l'encodage du lien de partage, l'adresse de la ligne d'en-tête, et le
 * classement des erreurs — qui décide si une fiche sera rejouée ou non.
 */
import { describe, expect, it } from "vitest";
import { colonneExcel, encoderLien, genreDeStatut, reessayable } from "../src/sharepoint/graph.js";

describe("l'encodage d'un lien de partage", () => {
  it("préfixe « u! », retire le remplissage et passe en base64 sûre pour une URL", () => {
    const code = encoderLien("https://contoso.sharepoint.com/:x:/s/eau/Doc.xlsx?e=abc");
    expect(code.startsWith("u!")).toBe(true);
    expect(code).not.toContain("=");
    expect(code).not.toContain("+");
    expect(code).not.toContain("/");
  });

  it("supporte les accents d'un nom de fichier", () => {
    // `btoa` seul lève sur un caractère hors latin-1 : c'est pour cela que le
    // lien passe par `TextEncoder` d'abord. Un nom de dossier accentué est la
    // règle, pas l'exception, dans un SharePoint francophone.
    expect(() => encoderLien("https://x.sharepoint.com/Données/Relevés été.xlsx")).not.toThrow();
  });

  it("ignore les espaces autour du lien collé", () => {
    expect(encoderLien("  https://a.b/c  ")).toBe(encoderLien("https://a.b/c"));
  });
});

describe("les adresses de colonnes Excel", () => {
  it("compte comme Excel", () => {
    expect(colonneExcel(0)).toBe("A");
    expect(colonneExcel(25)).toBe("Z");
    expect(colonneExcel(26)).toBe("AA");
    expect(colonneExcel(27)).toBe("AB");
    expect(colonneExcel(51)).toBe("AZ");
    expect(colonneExcel(52)).toBe("BA");
  });
});

describe("le classement des erreurs", () => {
  it("nomme chaque cas, parce qu'ils appellent des gestes opposés", () => {
    expect(genreDeStatut(401)).toBe("connexion");
    expect(genreDeStatut(403)).toBe("droits");
    expect(genreDeStatut(404)).toBe("introuvable");
    expect(genreDeStatut(423)).toBe("occupe");
    expect(genreDeStatut(429)).toBe("trop_vite");
    expect(genreDeStatut(503)).toBe("serveur");
    expect(genreDeStatut(400)).toBe("refus");
  });

  it("ne rejoue que ce qui est PASSAGER par nature", () => {
    expect(reessayable("hors_ligne")).toBe(true);
    expect(reessayable("occupe")).toBe(true);
    expect(reessayable("trop_vite")).toBe(true);
    expect(reessayable("serveur")).toBe(true);
    // Un 403 rejoué reste un 403 ; un refus de données aussi.
    expect(reessayable("droits")).toBe(false);
    expect(reessayable("refus")).toBe(false);
  });
});
