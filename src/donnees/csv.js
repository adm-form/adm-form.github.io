/*
 * L'EXPORT CSV — LA SORTIE DE SECOURS, ET ELLE N'EST PAS FACULTATIVE.
 *
 * Elle sert dans deux cas, et le second est le plus important :
 *   - avant que le SharePoint ne soit relié (une inscription d'application
 *     Azure demande parfois une semaine à la direction informatique) :
 *     l'application est utilisable dès le premier jour, les fiches
 *     s'accumulent dans la file et s'exportent ;
 *   - le jour où l'envoi refuse obstinément. Un technicien qui a trente
 *     fiches dans sa tablette et aucun moyen de les en sortir est dans une
 *     situation que cette application n'a pas le droit de créer.
 *
 * POINT-VIRGULE ET BOM UTF-8 : c'est ce qu'Excel en français attend. Avec une
 * virgule, tout tombe dans une seule colonne ; sans le BOM, les accents
 * sortent en mojibake. Les deux sont des défauts « d'apparence », donc des
 * défauts qu'on laisse traîner — alors qu'ils rendent le fichier inutilisable.
 */
import { TOUTES_COLONNES, ENTETES_DEFAUT } from "../sharepoint/colonnes.js";

const SEPARATEUR = ";";

export function echapper(valeur) {
  const texte = valeur === null || valeur === undefined ? "" : String(valeur);
  if (/["\n\r;]/.test(texte)) return `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

export function csv(fiches, reglages = {}) {
  const colonnes = TOUTES_COLONNES.filter((c) => ENTETES_DEFAUT.includes(c.entete));
  const lignes = [colonnes.map((c) => echapper(c.entete)).join(SEPARATEUR)];
  for (const fiche of fiches) {
    lignes.push(
      colonnes
        .map((c) => {
          const v = c.valeur
            ? c.valeur(fiche, reglages)
            : fiche.valeurs?.[c.code] ?? "";
          return echapper(Array.isArray(v) ? v.join(", ") : v);
        })
        .join(SEPARATEUR)
    );
  }
  return `﻿${lignes.join("\r\n")}\r\n`;
}

export function nomDuFichier(maintenant = new Date()) {
  const n = (x) => String(x).padStart(2, "0");
  return `fiches-terrain-${maintenant.getFullYear()}${n(maintenant.getMonth() + 1)}${n(
    maintenant.getDate()
  )}-${n(maintenant.getHours())}${n(maintenant.getMinutes())}.csv`;
}

export function telecharger(texte, nom) {
  const blob = new Blob([texte], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // L'URL d'objet est révoquée APRÈS le clic, jamais avant : révoquée trop
  // tôt, le téléchargement part sur une adresse morte et ne dit rien.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
