# Décisions de conception — Fiches Terrain

Ce qui a été tranché, et **pourquoi**. Chaque entrée dit le piège qu'elle
évite : c'est le piège qui justifie la décision, pas le goût.

---

## AUCUN SERVEUR : LA TABLETTE PARLE DIRECTEMENT À MICROSOFT

L'application est faite de fichiers statiques. Elle appelle Microsoft Graph
depuis le navigateur, avec le compte Microsoft 365 du technicien.

Trois conséquences, toutes décisives :

- **aucun secret à garder.** Un « client public » avec PKCE n'a pas de mot de
  passe d'application. Un secret posé dans une page web serait lisible par
  n'importe qui, et c'est précisément ce que le schéma applicatif
  (*client credentials*) aurait imposé ;
- **les droits sont ceux de la personne.** Si elle n'a pas accès au SharePoint,
  l'application ne l'a pas non plus. Rien à administrer, et aucune porte
  dérobée vers les fichiers d'un autre ;
- **rien à héberger ni à maintenir.** Un serveur intermédiaire aurait demandé
  un hébergement, une mise à jour, une surveillance — pour ne rien ajouter.

Le prix : une inscription d'application Azure, une fois, et une URI de
redirection à tenir à jour.

## LE FICHIER EXCEL EST LA SEULE VÉRITÉ

Pas de base de données intermédiaire, pas de copie « au cas où ». La file
d'attente de la tablette n'est pas une deuxième vérité : c'est un **sas**, qui
se vide dans le fichier.

Une base intermédiaire aurait créé la question à laquelle personne ne sait
répondre : si quelqu'un corrige une ligne dans Excel et que la plateforme garde
l'ancienne, laquelle fait foi ? Ici la question ne se pose pas.

## ENREGISTRER D'ABORD, ENVOYER ENSUITE — TOUJOURS

Le bouton « Enregistrer » met la fiche dans la file locale, **puis** tente
l'envoi. Jamais l'inverse.

Un hangar, un tunnel de service, une antenne saturée : le réseau manque
exactement là où le technicien travaille. Une application qui enverrait
directement afficherait « échec » et perdrait la saisie — au trentième point de
la journée, sous la pluie.

## ON ÉCRIT DANS LES COLONNES DU FICHIER, PAS DANS LES NÔTRES

L'application lit la ligne d'en-tête du tableau et place chaque champ sous la
colonne qui lui correspond, par son titre (casse, accents et ponctuation
ignorés, plus quelques synonymes).

Écrire les valeurs dans un ordre fixe aurait été plus court, et faux au premier
déplacement de colonne : les pH se seraient retrouvés dans « Débit » **sans la
moindre erreur à l'écran**. Un tableau décalé d'une colonne ne se voit qu'au
moment d'interpréter les résultats, des semaines plus tard.

Corollaire : **une colonne inconnue reçoit `null`, jamais `""`.** Graph laisse
alors la cellule telle quelle, tandis qu'une chaîne vide l'écraserait. Sur une
colonne portant une formule du professionnel, la différence est entre « on n'y
touche pas » et « on l'efface ».

Corollaire : **le contrôle des colonnes nomme les champs qui n'ont nulle part
où aller.** Un champ saisi qui n'a pas de colonne est une saisie perdue, et
l'envoi réussit quand même : rien ne le dirait sans ce contrôle.

## UNE VALEUR SAISIE À LA MAIN N'EST JAMAIS RÉÉCRITE

Deux automatismes remplissent la fiche : le « - » de YUL et la matrice du
point. Les deux s'effacent devant une saisie manuelle.

Sans cette règle, un technicien qui mesure un pH puis **corrige l'aéroport**
verrait sa mesure remplacée par « - » : une donnée relevée sur le terrain,
effacée par une automatisation, en silence. L'état retient donc ce qui vient de
la main (`touches`) et ce qui vient d'une déduction (`auto`) — et une valeur
déduite **s'affiche comme telle** (« déduit du point »), faute de quoi personne
ne sait s'il faut la vérifier.

Symétrique : **on ne rend que ce qu'on a pris.** Passer de YUL à YMX efface les
« - » que YUL avait posés, et rien d'autre.

## « - » N'EST PAS UNE CASE VIDE

Une case vide est un **oubli** ; « - » est une **décision** (le paramètre n'est
pas relevé à cet aéroport). Les écrire de la même façon ferait chercher une
mesure qui n'a jamais été prévue. D'où le bouton « - » à côté de chaque champ
numérique, et la valeur `-` écrite telle quelle dans le fichier.

## LE POINT S'OUBLIE QUAND L'AÉROPORT CHANGE

« Sa1 » existe à YUL **et** à YMX sans désigner le même ouvrage. Garder le point
en changeant d'aéroport serait pire que le perdre : la fiche partirait sur un
point qui n'existe pas là où on se trouve.

## LES OBSERVATIONS NE SE REPORTENT JAMAIS D'UNE FICHE À L'AUTRE

La fiche suivante garde l'aéroport, la campagne, le technicien et la date —
trente points dans la même journée, c'est trente fois les mêmes quatre champs,
et c'est à la trentième qu'on se trompe.

Elle ne garde **rien** des observations. Une odeur ou une turbidité reportée
serait une fausse donnée, du genre qu'on ne détecte pas en relisant.

## LES ANOMALIES AVERTISSENT, ELLES NE BLOQUENT PAS

Un pH de 15 est très probablement une faute de frappe. Mais un refus bloquant,
sur une tablette sous la pluie, fait saisir n'importe quoi pour passer à
l'écran suivant. On montre le doute, on laisse enregistrer.

Seuls l'aéroport, la campagne, le technicien, la date, l'heure, le point, la
matrice et la méthode sont **obligatoires** : ce sans quoi la ligne ne veut
rien dire. Aucune observation ne l'est — une fiche incomplète vaut mieux qu'une
fiche fausse.

## AUCUNE MATRICE N'EST DEVINÉE À PARTIR DU NOM DU POINT

« RP-102 » est très probablement un regard pluvial, « Sa1 » un sanitaire. Une
supposition écrite dans un référentiel **a l'air d'une donnée**, et c'est
exactement ce sur quoi on finit par se fier. Les matrices sont donc vides tant
que le professionnel ne les a pas posées, et le nombre de points sans matrice
est affiché : il dit ce qui reste à faire.

L'attribution **en lot par préfixe** existe pour que ce travail prenne cinq
minutes : « tous les points en `RP-` sont au pluvial » est une phrase
vérifiable d'un coup d'œil, alors que 88 choix un par un sont 88 occasions de
se tromper.

**Un `-CQ` hérite de son point de base.** Un contrôle qualité est prélevé au
même endroit que le point qu'il double : lui donner une matrice propre créerait
deux vérités pour le même ouvrage, qui pourraient diverger.

## CHAQUE FICHE PORTE UN IDENTIFIANT DANS LE FICHIER

Si le réseau coupe **après** que Microsoft a écrit la ligne mais **avant** que
la réponse n'arrive, la fiche reste « en attente » alors qu'elle est déjà dans
le fichier : la rejouer la dupliquerait, et rien ne le signalerait.

D'où la colonne « Identifiant de la fiche », et d'où la vérification faite
**uniquement** pour les fiches qui ont déjà connu une tentative — un premier
essai n'a rien à vérifier, et la vérification coûte une lecture de colonne.

## UN ÉCHEC NE SE TRAITE PAS COMME LES AUTRES

- Plus de réseau, session expirée, droit manquant, fichier introuvable : la
  fiche suivante échouerait à l'identique. **On arrête la tournée** et on
  affiche un message, au lieu de quatre-vingt-dix lignes rouges.
- Un refus propre à une fiche : on la marque et **on continue**. Bloquer toute
  la journée sur une fiche fautive serait pire.

Les erreurs sont donc **nommées** (`hors_ligne`, `connexion`, `droits`,
`introuvable`, `occupe`, `trop_vite`, `serveur`, `refus`), parce qu'elles
appellent des gestes opposés : se reconnecter, demander un droit, corriger le
lien, ou simplement attendre. Un message unique « échec de l'envoi » ferait
ressaisir une fiche qui n'avait besoin que de réseau.

## DES BOUTONS, PAS DES LISTES DÉROULANTES

Un menu déroulant demande deux gestes précis ; cinq boutons de 48 pixels en
demandent un seul et montrent toutes les options d'un coup. Sous 48 pixels, on
manque la cible et on choisit l'option voisine — c'est-à-dire qu'on enregistre
une observation fausse sans le voir.

L'exception est la liste des points (62 à YUL) : elle a un **filtre**, parce que
62 boutons ne se cherchent pas à l'œil. La liste reste dans l'ordre du
référentiel, celui auquel le professionnel est habitué.

## UNE COLONNE PAR ANALYSE

Les treize analyses sont créées comme treize colonnes marquées d'un `X` : ça se
filtre, ça se compte, ça se somme. Une seule colonne « HP, HAP, Métaux » ne
permet aucun des trois.

Mais si le fichier existant porte **une** colonne « Analyses effectuées »,
l'application sait la remplir : c'est le fichier du professionnel qui commande,
pas l'inverse.

## L'EXPORT CSV N'EST PAS FACULTATIF

Il sert avant que le SharePoint ne soit relié (une inscription Azure demande
parfois une semaine), et le jour où l'envoi refuse obstinément. Une application
qui enferme trente fiches dans une tablette sans aucun moyen de les en sortir
n'a pas le droit d'exister.

Point-virgule et BOM UTF-8 : sans le premier, tout tombe dans une seule colonne
d'Excel ; sans le second, les accents sortent en charabia. Deux défauts
« d'apparence », donc deux défauts qu'on laisse traîner — alors qu'ils rendent
le fichier inutilisable.

## LE SERVICE WORKER MET EN CACHE L'APPLICATION, JAMAIS LE TRAVAIL

Le HTML est en **réseau d'abord** : c'est lui qui référence les fichiers
versionnés, donc c'est lui qui, périmé, fige toute l'application. Les fichiers
produits par Vite (empreinte dans le nom) sont en cache d'abord — un même nom
ne peut pas désigner deux contenus.

Aucun appel à Microsoft Graph n'est mis en cache : une réponse rejouée depuis
un cache ferait croire qu'une fiche est partie alors qu'elle ne l'est pas.

## LA FILE D'ATTENTE A UN SECOURS, ET CE N'EST PAS UNE ÉLÉGANCE

IndexedDB d'abord (il échappe à l'expiration des stockages d'iOS sur une
application installée), `localStorage` si IndexedDB lève — ce qu'il fait en
navigation privée sur certains navigateurs. C'est le seul endroit du projet où
une donnée saisie pourrait disparaître.

## RIEN N'EST SUPPRIMÉ APRÈS L'ENVOI

Une fiche envoyée reste visible, avec son heure d'envoi. Le technicien doit
pouvoir vérifier ce qui est parti sans ouvrir le fichier Excel sur un
téléphone ; et s'il manque une ligne le lendemain, il faut encore avoir de quoi
comparer. Le ménage est un geste explicite.
