# CLAUDE.md — Fiches Terrain (échantillonnage des eaux YUL / YMX)

Lu au début de chaque session. Donne le contexte pour éviter de repartir de
zéro.

---

## Ce qu'est le projet

Application **installable sur tablette** (PWA) pour remplir la fiche terrain
d'échantillonnage d'eau aux aéroports de Montréal (YUL) et Mirabel (YMX), et
verser chaque fiche comme **une ligne d'un fichier Excel hébergé sur un
SharePoint**, via Microsoft Graph.

Projet **distinct** de la plateforme EDD (`../edd_saas`) : aucun code partagé,
aucune dépendance. Même auteur, mêmes habitudes de travail.

Le projet est développé par un professionnel de l'environnement, pas un
développeur de métier. Privilégier les explications claires et les solutions
simples. **Langue : tout en français** (interface, commentaires, documentation).

---

## Stack

- **React + Vite**, Tailwind. **Aucun backend** — voir la décision « AUCUN
  SERVEUR » dans `DECISIONS.md`.
- **`@azure/msal-browser`** pour la connexion Microsoft (client public, PKCE,
  **redirection** et non fenêtre surgissante).
- **Microsoft Graph**, API classeur : `tables/{t}/rows/add`. On n'ouvre jamais
  le .xlsx, on ne le télécharge pas, on ne le réécrit pas.
- **Vitest** (+ jsdom et Testing Library pour les essais d'écran).

## Commandes

```
npm run dev      # http://localhost:5174/  (5173 est pris par la maquette EDD)
npm test         # 112 essais, ~2 s
npm run build    # dist/ — des fichiers statiques
npm run icones   # régénère les PNG de public/ (aucune dépendance)
```

---

## État actuel

- **La fiche est complète** et conforme à la demande du 2026-10-02 : aéroport,
  campagne, technicien, date, heure, point, matrice, méthode, turbidité,
  couleur + intensité, odeur + nature, sédiments, débit, température, O₂ (%),
  O₂ (mg/L), pH, les analyses + case « CQ » (duplicata prélevé), remarques.
- **Les 88 points sont livrés** (62 YUL, 26 YMX) dans l'ordre et à
  l'orthographe fournis — **sans matrice** : elles s'attribuent dans l'écran
  Points. Voir « AUCUNE MATRICE N'EST DEVINÉE ».
- **112 essais verts**, dont 19 qui MONTENT les écrans dans jsdom.
- **Jamais essayé contre un vrai SharePoint** : l'inscription Azure et le lien
  du fichier n'existent pas encore. Toute la couche Graph est donc écrite mais
  non éprouvée en vrai — c'est la première chose à faire quand les
  identifiants arriveront.

### Ce qui reste à décider (noté le 2026-10-02)

1. **Les matrices des 88 points** (Surface / Pluvial / Sanitaire / Boue).
2. **La nature de l'odeur est un choix UNIQUE.** Si une odeur mixte doit
   pouvoir être notée : `type: "multi"` dans `schema.js`.
3. **L'ordre et le libellé des colonnes** si le fichier Excel existant diffère
   de ce que l'application crée.

---

## Pièges à ne pas redécouvrir

- **UN IDENTIFIANT NON DÉCLARÉ = UN ÉCRAN BLANC, ET VITE NE DIT RIEN.** Vite
  tient un identifiant inconnu pour une variable globale et **compile sans un
  mot** ; le `ReferenceError` ne tombe qu'à l'exécution, en démontant tout
  l'arbre React. **La construction ne le voit pas.** Seul `tests/ecrans.test.jsx`
  le voit, parce qu'il MONTE les écrans pour de vrai. Tout nouvel écran y gagne
  au moins un essai de montage.
- **L'URI DE REDIRECTION AZURE DOIT CORRESPONDRE EXACTEMENT**, barre oblique
  finale comprise, et le type doit être **SPA** (pas « Web » : Azure refuserait
  alors le flux PKCE sans secret). `AADSTS50011` = cette ligne.
- **UN FLUX POWER AUTOMATE DÉCLENCHÉ PAR HTTP N'EST PAS UNE SOLUTION DE
  RECHANGE** (vérifié le 2026-10-02, après un 401 dans le portail Azure). Deux
  obstacles INDÉPENDANTS : le déclencheur « Lorsqu'une requête HTTP est reçue »
  ne renvoie **aucun en-tête CORS** — donc un navigateur ne peut pas l'appeler,
  la requête préalable échoue — et il exige une **licence Premium**, absente
  des plans Microsoft 365 courants. Ce qui marche sans droit d'administrateur,
  c'est un flux à connecteurs STANDARD déclenché par **l'arrivée d'un fichier**
  dans un dossier SharePoint, l'application exportant le fichier et le
  technicien le déposant. Un geste manuel par journée, mais rien à demander.
- **UNE ADRESSE DE TUNNEL ÉPHÉMÈRE NE CONVIENT PAS ICI** : elle change à chaque
  lancement, donc l'URI de redirection serait à réinscrire à chaque fois. Il
  faut une adresse fixe.
- **UN COMPOSANT DÉFINI DANS LE CORPS DU RENDU PERD LE FOCUS** : React le voit
  comme un type neuf à chaque frappe, démonte l'input et le remonte. Tous les
  composants sont au niveau du module.
- **`data-champ` EST NÉCESSAIRE, PAS DÉCORATIF** : plusieurs champs portent les
  mêmes options (« Aucune » est une couleur ET une odeur ; « Faible » une odeur
  ET un débit). Sans repère par champ, ni un essai ni un diagnostic ne peuvent
  désigner le bon bouton.
- **LE SHELL MANGE LES ACCENTS GRAVES** (piège hérité du projet EDD) : tout
  contenu français destiné à un fichier s'écrit par un outil d'écriture de
  fichier, jamais dans une chaîne qui traverse bash — les identifiants entre
  accents graves y seraient pris pour des substitutions de commande, exécutés,
  et remplacés par du vide, **sans erreur**.
- **ÉCRIRE `""` DANS UNE COLONNE INCONNUE L'EFFACERAIT.** Graph laisse la
  cellule intacte sur `null`. Sur une colonne portant une formule, c'est la
  différence entre « on n'y touche pas » et « on l'efface ».
- **LE `%` ET LE `&` PORTENT DU SENS DANS UN EN-TÊTE.** En les retirant comme
  de la ponctuation, « Oxygène dissous (%) » et « Oxygène dissous (mg/L) » se
  réduisent au même texte, et une saturation part dans la colonne des mg/L.
  `normaliser()` les traduit (`pct`, `et`) au lieu de les supprimer.
- **UNE RÈGLE CSS ÉCRITE APRÈS `@tailwind utilities` ÉCRASE SES PADDINGS**
  (piège hérité d'EDD) : les classes de zone sûre portent donc leur marge de
  base dans un `calc()`, et les éléments concernés ne portent aucune classe
  Tailwind sur le même axe.

---

## Structure

Voir `README.md` (section « Organisation du code ») pour la carte des fichiers,
et `DECISIONS.md` pour ce qui a été tranché et pourquoi. Les deux fichiers sont
à jour au 2026-10-02.

**Le cœur est `src/fiche/schema.js`** : champs, options, obligations,
conditions. Les écrans ne font que le rendre, et `sharepoint/colonnes.js` ne
fait que le verser dans les colonnes du fichier. Ajouter une option ou un champ
se fait là — et `tests/colonnes.test.js` vérifie qu'un champ ajouté n'a pas été
oublié côté colonnes, ce qui serait une saisie perdue en silence.
