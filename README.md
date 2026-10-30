# Fiches Terrain — échantillonnage des eaux YUL / YMX

Application **installable sur tablette** pour remplir la fiche terrain
d'échantillonnage d'eau, et verser chaque fiche comme **une ligne d'un fichier
Excel qui vit sur un SharePoint**.

Elle fonctionne **hors ligne** : la fiche est enregistrée dans la tablette au
moment où on appuie, et part dans le fichier dès que le réseau revient.

---

## En deux minutes

```bash
npm install
npm run dev      # http://localhost:5174/
```

Les trois autres commandes :

```bash
npm test         # 124 essais
npm run build    # produit dist/ (des fichiers statiques, à héberger n'importe où)
npm run icones   # refait les icônes de l'application installée
```

---

## Ce que l'application fait

- **La fiche** : aéroport (YUL / YMX), type de campagne, technicien, date,
  heure, point d'échantillonnage, matrice, méthode, turbidité, couleur et son
  intensité, odeur et sa nature, sédiments, débit, température, oxygène dissous
  (% et mg/L), pH, les analyses, le champ « CQ » Oui / Non (duplicata prélevé), et en campagne intensive l’heure du prélèvement par le système et des remarques.
- **Ce qui se remplit tout seul** :
  - choisir **YUL** passe les quatre paramètres physico-chimiques à « - »
    (non mesuré) ; **YMX** les laisse à saisir ;
  - choisir un **point** pose sa **matrice** (et sa méthode, si le référentiel
    en déclare une).
  - Dans les deux cas, **une valeur saisie à la main n'est jamais réécrite**.
- **La fiche suivante** garde l'aéroport, la campagne, le technicien et la date.
  Elle ne garde **aucune observation** — une odeur reportée d'un point à
  l'autre serait une fausse donnée.
- **La file d'attente** garde tout ce qui est saisi, montre ce qui est parti et
  ce qui attend, et sait **exporter en CSV** (séparateur `;`, UTF-8, ouvrable
  directement dans Excel) si le SharePoint n'est pas encore relié.

---

## Les points d'échantillonnage

62 points à YUL, 26 à YMX, livrés avec l'application
(`src/donnees/points_defaut.json`), dans l'ordre fourni et à l'orthographe
exacte.

**Leur matrice n'est pas renseignée**, et c'est délibéré : une matrice devinée
d'après le nom du point aurait l'air d'une donnée sans en être une. L'écran
**Points** sert à les attribuer :

- un appui par point (quatre boutons : Surface / Pluvial / Sanitaire / Boue) ;
- ou **en lot par préfixe** : « tous les points qui commencent par `RP-` sont
  au pluvial » — une phrase vérifiable d'un coup d'œil ;
- ou en **collant une liste** depuis Excel (`point ; matrice ; méthode`).

Les points en `-CQ` n'ont **pas** de matrice propre : ils reprennent celle de
leur point de base (`B1-CQ` suit `B1`), un contrôle qualité étant prélevé au
même endroit.

Ce qui est attribué dans l'écran Points vit **dans la tablette**. Pour que
toutes les tablettes en profitent, reporter les matrices dans
`src/donnees/points_defaut.json` et reconstruire.

---

## Relier le fichier Excel du SharePoint

### 1. Inscrire l'application dans Azure (une seule fois)

À faire par vous ou par la direction informatique. **Aucun mot de passe
d'application n'est nécessaire** : l'application est un « client public », elle
n'a aucun secret à cacher.

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** →
   **Inscriptions d'applications** → **Nouvelle inscription**.
2. Nom : `Fiches Terrain`.
3. Types de comptes : **Comptes dans cet annuaire d'organisation uniquement**.
4. URI de redirection : choisir **Application monopage (SPA)** — surtout pas
   « Web » — et saisir l'adresse où l'application sera hébergée, **barre
   oblique finale comprise** :
   - `https://fiches-terrain.exemple.com/`
   - et, pour le développement, `http://localhost:5174/`
5. **Inscrire**, puis relever sur la page d'accueil :
   - **ID d'application (client)** → à coller dans l'écran Réglages ;
   - **ID d'annuaire (locataire)** → facultatif, voir plus bas.
6. **Autorisations d'API** → **Ajouter** → **Microsoft Graph** →
   **Autorisations déléguées** → cocher **Files.ReadWrite.All**
   (`User.Read` y est déjà). Puis **Accorder le consentement administrateur**
   si votre organisation l'exige.

> **L'URI de redirection doit correspondre EXACTEMENT** à l'adresse d'où
> l'application est servie. C'est la cause numéro un des échecs de connexion
> (`AADSTS50011`). Une adresse de tunnel éphémère change à chaque lancement :
> pour cette application, préférer un hébergement à adresse fixe.

> **Erreur 401 dans le portail au moment de créer l'inscription ?** C'est le
> droit d'inscrire des applications qui manque (désactivé par défaut dans la
> plupart des grandes organisations), ou le portail posé sur le mauvais
> répertoire, ou une session expirée. `DEMANDE_TI.md` contient un texte prêt à
> coller pour la demande de service.

### Ce qui ne marche PAS comme solution de rechange

Mesuré avant de l'écrire, pour que personne ne le redécouvre : faire appeler un
**flux Power Automate déclenché par HTTP** depuis l'application est une impasse,
pour deux raisons indépendantes.

1. **Le déclencheur « Lorsqu'une requête HTTP est reçue » ne renvoie aucun
   en-tête CORS.** Un navigateur refuse donc l'appel dès la requête préalable
   (*preflight*). Il faudrait interposer un service (API Management, une
   fonction Azure…) — c'est-à-dire exactement le serveur que ce projet n'a pas.
2. **Ce déclencheur exige une licence Power Automate Premium**, que les plans
   Microsoft 365 courants n'incluent pas.

La solution de rechange réellement praticable, si l'inscription Azure est
refusée, est d'un autre ordre : **l'application exporte un fichier, le
technicien le dépose dans un dossier SharePoint, et un flux Power Automate
n'employant que des connecteurs standard** (SharePoint, Excel Online Business,
opérations de données) **l'ajoute au classeur**. Aucun droit d'administrateur,
aucune licence premium — mais un geste manuel par journée de terrain.

### 2. Préparer le fichier Excel

Les lignes s'ajoutent à la fin d'un **tableau** Excel — un vrai tableau, pas
une simple plage de cellules. C'est ce qui permet d'ajouter une ligne sans
jamais toucher au reste du fichier, **même s'il est ouvert par quelqu'un
d'autre au même moment**.

Deux cas :

- **Le fichier existe déjà avec ses colonnes** : dans Excel, sélectionner la
  plage et faire **Insertion > Tableau** (en cochant « Mon tableau comporte des
  en-têtes »). L'application reconnaîtra les colonnes par leur titre.
- **Le fichier est vide** : l'écran Réglages propose de créer le tableau et ses
  36 colonnes sur une feuille vide. Une feuille qui contient déjà quelque chose
  est **refusée** — écrire nos en-têtes par-dessus effacerait son contenu.

**L'application écrit dans VOS colonnes, pas dans les siennes.** Elle lit la
ligne d'en-tête et place chaque champ sous la colonne qui lui correspond ; les
colonnes qu'elle ne connaît pas (numéro de rapport, résultats de laboratoire,
formules) sont laissées **intactes**. Quelques synonymes sont reconnus :
« Site » pour « Aéroport », « Station » pour « Point d'échantillonnage »,
« OD (mg/L) » pour « Oxygène dissous (mg/L) »…

Les analyses peuvent être écrites de deux façons, selon ce que porte le
fichier : **une colonne par analyse** (`HP`, `HAP`, `H&G`…, marquées d'un `X` —
c'est ce que l'application crée, parce que ça se filtre et ça se compte), ou
**une seule colonne** « Analyses effectuées » qui les reçoit toutes, séparées
par des virgules.

### 3. Dans l'écran Réglages de l'application

1. **Connexion Microsoft** : coller l'ID d'application, puis « Se connecter ».
   Le locataire peut rester `organizations` ; y mettre l'ID d'annuaire si l'on
   veut n'autoriser que les comptes de l'organisation.
2. **Le fichier** : dans SharePoint ou Teams, « Copier le lien » du fichier, le
   coller, puis « Trouver le fichier ». Le lien ne sert qu'une fois ; ensuite
   l'application suit le fichier par son identifiant, donc **un fichier renommé
   ou déplacé reste trouvé**.
3. **Où écrire** : choisir le tableau (ou le créer).
4. **Contrôle des colonnes** : il dit si un champ de la fiche **n'a pas de
   colonne** — ce qui y serait saisi n'irait nulle part, sans la moindre erreur
   à l'écran. C'est l'étape qui mérite le plus d'attention.

---

## Installer sur la tablette

L'application s'installe depuis le navigateur, mais **il faut du HTTPS** : sans
contexte sécurisé, ni l'installation ni le fonctionnement hors ligne ne sont
possibles (le navigateur ne dit pas toujours pourquoi).

- **iPad / iPhone** : ouvrir l'adresse dans Safari → bouton Partager →
  « Sur l'écran d'accueil ».
- **Android** : Chrome → menu → « Installer l'application ».

### Adresse de l'application (GitHub Pages)

**https://adm-form.github.io/**

1. Ouvrir cette adresse **une première fois avec du réseau**, et attendre que
   la fiche s'affiche : c'est là que l'application se copie dans la tablette.
2. Ajouter à l'écran d'accueil (iPad : Safari → Partager → « Sur l'écran
   d'accueil » ; Android : Chrome → menu → « Installer l'application »).
3. Ensuite, elle s'ouvre et fonctionne **sans réseau**.

### Mettre à jour

Chaque modification poussée sur la branche `main` est construite et publiée
toute seule (onglet **Actions** du dépôt, ~2 minutes). Sur la tablette, il
suffit d'ouvrir l'application **avec du réseau** : la nouvelle version
s'installe en arrière-plan et s'applique à la **fermeture puis réouverture**
de l'application. Les fiches saisies ne sont pas touchées par une mise à jour.

### Exporter

Écran **Envois** : **Exporter en CSV**, **Exporter en Excel** (.xlsx, fabriqué
dans la tablette, sans réseau) ou **Partager** (feuille de partage de la
tablette : courriel, Teams, OneDrive… avec le fichier joint ; si la tablette
ne l'offre pas, le fichier est téléchargé à la place).

### Autre hébergeur

`VITE_BASE=/nom-du-depot/ npm run build` produit une version pour un dépôt Pages ordinaire (adresse avec sous-chemin).
**Ne pas oublier d'ajouter l'adresse retenue dans les URI de redirection de
l'inscription Azure** — sur GitHub Pages :
`https://adm-form.github.io/`, barre oblique finale comprise.

---

## Ce qui se passe hors ligne

| | |
|---|---|
| Ouvrir l'application | Oui — après une première ouverture en ligne, le service worker garde tous les fichiers |
| Remplir et enregistrer | Oui — la fiche va dans la file d'attente locale |
| Envoyer dans Excel | Non — l'envoi repart **tout seul** au retour du réseau |
| Exporter en CSV / Excel, Partager | Oui |

Rien n'est supprimé après l'envoi : la fiche reste visible dans l'écran
**Envois**, avec son heure d'envoi, jusqu'à ce qu'on fasse le ménage soi-même.

**La double écriture est le piège sérieux** : si le réseau coupe après que
Microsoft a écrit la ligne mais avant que la réponse n'arrive, la fiche
paraîtrait « non envoyée ». C'est pourquoi chaque fiche porte un identifiant
dans une colonne du fichier : avant de rejouer une fiche qui a déjà connu une
tentative, l'application vérifie qu'elle n'y est pas déjà.

---

## Organisation du code

```
src/
  fiche/schema.js       LA DÉFINITION DE LA FICHE : champs, options, règles.
                        Ajouter une option d'odeur se fait ici, en une ligne.
  fiche/regles.js       Ce qui se remplit tout seul, et ce qu'on ne réécrit
                        jamais. Pur, donc entièrement éprouvé.
  fiche/champs.jsx      Les boutons de saisie, taillés pour un doigt ganté.
  fiche/Formulaire.jsx  La mise en page de la fiche.
  donnees/points*       Le référentiel des points et leur matrice.
  donnees/file.js       La file d'attente (IndexedDB, secours localStorage).
  donnees/csv.js        L'export de secours.
  sharepoint/colonnes.js  La correspondance champs ↔ colonnes du fichier.
  sharepoint/graph.js     Les appels Microsoft Graph.
  sharepoint/auth.js      La connexion Microsoft (MSAL, redirection, PKCE).
  sharepoint/envoi.js     La tournée d'envoi et le traitement des échecs.
  ecrans/               Réglages, Envois, Points.
```

`DECISIONS.md` garde le détail de ce qui a été tranché et pourquoi.

---

## Ce qui reste à décider

- **Les matrices des 88 points** (voir plus haut) ;
- **la nature de l'odeur est un choix UNIQUE** (Glycol / Organique / Minérale /
  Hydrocarbures). Si une odeur mixte doit pouvoir être notée, c'est un mot à
  changer dans `schema.js` (`type: "multi"`) ;
- **l'ordre et le libellé des colonnes du fichier Excel**, si le fichier
  existant diffère de ce que l'application crée.
