# Demande d'inscription d'application — Fiches Terrain

*Document de réponse au formulaire de demande d'ajout d'application. Les
sections ci-dessous reprennent les questions posées : autorisations,
authentification, méthode d'authentification de l'application (certificat /
secret / aucun), et justification commerciale.*

---

## 1. Identification de l'application

| Paramètre | Valeur |
|---|---|
| Nom proposé | `Fiches Terrain` |
| Type | Application monopage (**SPA**) — JavaScript exécuté dans le navigateur |
| Types de comptes | **Comptes de cet annuaire d'organisation uniquement** (mono-locataire WSP) |
| URI de redirection | `https://<adresse-d-hébergement>/` et `http://localhost:5174/` pour les essais |
| Éditeur | Interne (usage WSP, non distribuée, non publiée) |
| API appelée | Microsoft Graph uniquement |
| Hébergement | Fichiers statiques, aucun serveur applicatif, aucune base de données |

> **L'URI de redirection doit être exacte, barre oblique finale comprise, et la
> plateforme doit être déclarée « SPA » et non « Web ».** D'autres URI peuvent
> être ajoutées plus tard sans refaire la demande : il n'est donc pas bloquant
> que l'adresse d'hébergement définitive ne soit pas encore arrêtée.

---

## 2. Autorisations requises

**Toutes sont des autorisations DÉLÉGUÉES** (Microsoft Graph), c'est-à-dire
exercées *au nom de l'utilisateur connecté* et bornées par ses propres accès.

| Autorisation | Type | Ce qu'elle sert à faire |
|---|---|---|
| `Files.ReadWrite.All` | Déléguée | Ajouter une ligne au classeur Excel du SharePoint de l'équipe |
| `User.Read` | Déléguée | Afficher qui est connecté sur la tablette (ajoutée par défaut à toute inscription) |
| `openid`, `profile`, `offline_access` | Déléguée (OIDC) | Connexion, et maintien de la session sans redemander le mot de passe à chaque ouverture |

### Aucune autorisation d'application n'est demandée

C'est le point qui détermine le risque, et il mérite d'être lu deux fois :

- **Aucune permission *app-only*.** L'application ne peut rien faire sans
  qu'un utilisateur soit connecté. Elle ne tourne jamais en arrière-plan, et
  il n'existe aucune identité de service.
- **L'accès ne dépasse jamais celui de la personne.** `Files.ReadWrite.All`
  délégué signifie « les fichiers que l'utilisateur connecté peut déjà
  ouvrir » — ni plus, ni autrement. Si la personne perd l'accès au site
  SharePoint, l'application le perd au même instant, sans qu'on ait à la
  reconfigurer.
- **Aucune donnée ne sort du locataire.** Il n'y a pas de serveur
  intermédiaire ni de service tiers : la tablette parle directement à
  Microsoft 365.
- **Aucune écriture hors du fichier visé.** L'application n'écrit que dans le
  classeur configuré, et uniquement en ajoutant des lignes à la fin d'un
  tableau (`workbook/tables/{id}/rows/add`). Elle ne supprime rien, ne
  déplace rien, ne modifie aucune cellule existante.

### Si la portée est jugée trop large

`Files.ReadWrite.All` est la plus étroite des autorisations qui permettent
d'écrire dans un fichier hébergé sur un **site SharePoint d'équipe** depuis un
client public. Les solutions de rechange et leur coût réel :

| Option | Pourquoi elle ne convient pas ici |
|---|---|
| `Files.ReadWrite` | Ne couvre que le OneDrive personnel de l'utilisateur, pas un site d'équipe |
| `Sites.Selected` | Autorisation **d'application** : impose un secret ou un certificat, donc un serveur à héberger — ce que cette solution évite précisément |
| `Files.ReadWrite.Selected` | Prévue pour un sélecteur de fichiers interactif, inadaptée à un envoi différé hors ligne |

**Un consentement administrateur est à prévoir.** Microsoft ne l'exige pas pour
cette autorisation déléguée, mais la politique de consentement utilisateur en
vigueur chez WSP le rendra probablement nécessaire.

---

## 3. Cette application sert-elle à authentifier des utilisateurs ?

**Non, au sens où la question est habituellement posée.**

- Elle **n'est pas un fournisseur d'identité** : elle n'authentifie personne
  pour le compte d'une autre application, n'émet aucun jeton, n'ouvre aucune
  session ailleurs.
- Elle **ne gère aucun identifiant** : pas de compte local, pas de mot de
  passe, pas de base d'utilisateurs, pas de réinitialisation. Rien à voler.
- Elle **n'autorise rien elle-même** : elle ne décide pas qui a le droit
  d'écrire dans le fichier. C'est SharePoint qui tranche, exactement comme si
  la personne ouvrait le classeur à la main.

**Oui, au seul sens suivant** : les utilisateurs **s'y connectent avec leur
compte WSP**, par Microsoft Entra ID (OpenID Connect, bibliothèque MSAL de
Microsoft), afin d'obtenir un jeton d'accès à Microsoft Graph. L'authentification
est donc entièrement déléguée à Entra ID — MFA, accès conditionnel et
révocation inclus et appliqués sans aucune intervention de l'application.

**Utilisateurs visés** : les techniciens de terrain affectés aux campagnes
d'échantillonnage YUL / YMX, soit un petit nombre de personnes, toutes
titulaires d'un compte WSP et déjà autorisées sur le SharePoint concerné.

---

## 4. Certificat, secret, ou aucun ?

**AUCUN.** Ni secret client, ni certificat.

L'application est un **client public** utilisant le flux *Authorization Code
avec PKCE*, le schéma que Microsoft prescrit pour les applications monopage.

Ce n'est pas une préférence, c'est une contrainte dans les deux sens :

- **un secret serait inutilisable** : tout ce qui est livré à un navigateur
  est lisible par quiconque ouvre les outils de développement. Un secret
  déposé là ne serait pas un secret ;
- **Entra ID le refuse** : une inscription déclarée sur la plateforme « SPA »
  n'accepte pas d'authentification par secret ou par certificat. PKCE la
  remplace, en liant la demande de jeton à la session du navigateur qui l'a
  initiée.

Conséquence pratique pour vous : **rien à faire tourner, rien à renouveler, et
aucune échéance à surveiller.** Pas de secret expirant tous les six, douze ou
vingt-quatre mois, donc pas de panne le jour de l'expiration.

### Si le formulaire exige le chargement d'un certificat

*Réponse à porter dans le champ, ou à transmettre au réviseur :*

> **Sans objet : application monopage, donc client public.** Microsoft
> l'interdit explicitement pour ce type d'application : « *Public clients,
> which include native applications and single page apps, must not use secrets
> or certificates when redeeming an authorization code* »
> ([documentation du flux Authorization Code, Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)).
> Entra ID refuse d'ailleurs le secret et le certificat sur une plateforme
> déclarée « SPA ». L'authentification de l'application repose sur **PKCE**,
> qui remplace le secret par un code à usage unique, généré à chaque
> connexion, jamais stocké et inutilisable une seconde fois.
> Merci d'indiquer la marche à suivre prévue pour un client public.

Le formulaire suppose vraisemblablement un **client confidentiel** (service ou
tâche de fond s'authentifiant sans utilisateur). Vérifier s'il comporte, plus
haut, un choix de **type d'application** — « client public », « mobile et
bureau », « application monopage » — qui ouvre une autre branche et rend le
champ facultatif.

**Charger un certificat auto-signé pour satisfaire le champ est à éviter.** Il
ne serait jamais utilisé : il ne protégerait rien, ne changerait rien au
fonctionnement, et créerait trois ennuis bien réels — une échéance que
personne ne surveillera, une inscription classée à tort comme client
confidentiel, et un justificatif de sécurité auquel un réviseur futur se
fiera. Un dispositif qui rassure sans rien protéger est pire que son absence.

**Si la politique impose malgré tout un certificat**, alors ce n'est plus un
champ de formulaire à remplir mais une architecture différente à décider : un
certificat suppose un client confidentiel, donc un composant serveur pour le
détenir (le navigateur ne peut rien garder de secret). La forme viable serait
alors une petite fonction Azure, hébergée chez WSP, portant le certificat et
appelant Graph en mode application avec `Sites.Selected` — accès restreint à
**un seul site SharePoint**, ce qui est plus étroit que la demande actuelle.
Le coût n'est pas nul : un hébergement, un déploiement, une surveillance, et
le renouvellement du certificat. À arbitrer explicitement plutôt qu'à subir.

---

## 5. Justification commerciale

### La situation actuelle

Les campagnes d'échantillonnage des eaux aux aéroports de Montréal (YUL) et de
Mirabel (YMX) couvrent **88 points de prélèvement**, visités selon trois régimes
(régulier, intensif, spécial). Pour chaque point, le technicien consigne sur
une fiche papier l'heure, la méthode de prélèvement, les observations visuelles
et olfactives (turbidité, couleur et son intensité, odeur et sa nature,
sédiments, débit), les paramètres physico-chimiques mesurés sur place, et les
analyses demandées au laboratoire parmi treize paramètres.

Ces fiches sont **ressaisies au bureau** dans un classeur Excel hébergé sur le
SharePoint de l'équipe, qui sert ensuite au suivi et à la production des
rapports.

### Le problème

1. **Double saisie.** Chaque donnée est écrite deux fois : une fois sur le
   terrain, une fois au bureau. C'est du temps facturable consacré à de la
   transcription.
2. **Erreurs de transcription.** Une fiche remplie sous la pluie, avec un gant,
   se relit mal. Une case mal reportée dans un tableau ne se voit plus une fois
   transcrite — et les relevés de terrain alimentent des rapports signés par un
   professionnel et remis au client.
3. **Délai.** Les données n'existent dans le classeur qu'au retour au bureau,
   parfois plusieurs jours plus tard. Une anomalie relevée sur le terrain n'est
   donc pas visible immédiatement par l'équipe.
4. **Risque de perte.** Une fiche papier égarée ou détrempée est une sortie de
   terrain à refaire, à nos frais.

### La solution demandée

Une application web installée sur la tablette du technicien, qui présente la
fiche sous forme de choix fermés (boutons) plutôt que de texte libre, et verse
chaque fiche **comme une ligne du classeur Excel existant** — celui-là même qui
sert déjà, sans en créer un second.

Elle **fonctionne hors ligne** : la fiche est enregistrée dans la tablette au
moment de la saisie et part dans le classeur dès que le réseau revient. C'est
indispensable, le réseau manquant précisément là où les prélèvements se font.

### Les bénéfices

- **Suppression de la double saisie** : la donnée est saisie une fois, par
  celui qui l'observe.
- **Moins d'erreurs** : les listes fermées suppriment les ambiguïtés de
  lecture, et la matrice de chaque point est préremplie à partir d'un
  référentiel plutôt que retapée.
- **Données disponibles le jour même**, consultables par l'équipe pendant que
  la campagne se déroule.
- **Traçabilité** : chaque ligne porte qui l'a saisie, quand, et un identifiant
  unique qui empêche les doublons en cas de coupure réseau.
- **Qualité documentaire** : les relevés appuient des rapports professionnels
  remis au client et, le cas échéant, aux autorités. Une chaîne de saisie plus
  courte est une chaîne plus défendable.

### Le coût

**Nul, au-delà des licences Microsoft 365 déjà détenues.** Pas d'hébergement
applicatif, pas de serveur, pas de base de données, pas d'abonnement à un
service tiers, pas de licence Power Platform premium. L'application est
constituée de fichiers statiques, et le stockage reste le SharePoint existant.

### Les solutions de rechange étudiées

| Option | Pourquoi écartée |
|---|---|
| Garder le papier | Ne règle aucun des quatre problèmes ci-dessus |
| Microsoft Forms | Ne sait pas fonctionner hors ligne, ni préremplir à partir d'un référentiel de 88 points, ni alimenter un classeur existant sans le dupliquer |
| Flux Power Automate appelé par l'application | Techniquement impossible depuis un navigateur (absence d'en-têtes CORS sur le déclencheur HTTP) **et** soumis à une licence Premium |
| Application Power Apps | Envisageable, mais impose une licence par utilisateur et une réécriture complète ; à reconsidérer si la présente demande est refusée |

### Le risque, en une phrase

Une application sans secret, sans serveur, sans permission d'application, qui
n'accède qu'à ce que l'utilisateur connecté peut déjà ouvrir lui-même, et dont
l'accès disparaît en même temps que celui de la personne.

---

## Annexe — pourquoi le portail renvoie 401

Le portail Azure renvoie `401` au moment de créer l'inscription lorsque le
compte n'a pas le droit d'inscrire des applications dans l'annuaire — réglage
*Entra ID > Paramètres utilisateur > Les utilisateurs peuvent inscrire des
applications = Non*, qui est le défaut dans la plupart des grandes
organisations.

Deux autres causes donnent le même code et valent d'être écartées avant tout :
le portail posé sur **le mauvais répertoire** (menu « Changer de répertoire »,
en haut à droite) et une **session expirée** (se déconnecter, ou ouvrir le
portail en navigation privée).

**Variante la plus légère pour la TI** : attribuer le rôle **Développeur
d'applications** au demandeur, qui crée alors l'inscription lui-même ; il ne
reste à la TI que le consentement à accorder.
