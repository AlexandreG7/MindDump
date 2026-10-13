# Semainier : proposition pour le redesign v2

Statut : proposition produit, rien n'est validé. Les efforts sont des
estimations du responsable produit (S = moins d'une journée, M = 1 à 3 jours,
L = plus) : master les confirme avant planification. Aucun chiffre d'usage
n'existe ; les « impacts » sont des hypothèses.

## 1. Ce que fait le Semainier aujourd'hui

Sources lues : `src/app/kids/KidsWeekly.tsx`, `src/app/kids/KidsStats.tsx`,
`src/app/api/kids/route.ts`, `src/components/kids/icons.tsx`, modèle
`KidDayEntry` (`prisma/schema.prisma`).

1. Une page `/kids` par enfant (profil `FamilyProfile` de type `child`, choix
   mémorisé en localStorage) : 7 cartes colorées, une par jour, qui montrent
   les icônes saisies ; un appui ouvre l'éditeur du jour.
2. Cinq rubriques fixes, identiques pour tous les enfants : météo (6 choix),
   humeur (5), pipi (au sec / accident), sieste (oui / non), activités
   (12 choix multiples). Une ligne `KidDayEntry` par enfant et par jour.
3. Un mode enfant plein écran (semaine en cours seulement, sortie par appui
   long, fond qui ne ferme pas, ré-appui qui ne désélectionne pas) et un
   « Récap de la semaine » en surimpression (comptes par rubrique).
4. Le semainier appartient à l'enfant : tout membre du groupe le lit et le
   remplit ; l'API vérifie l'accès au profil.
5. Limites :
   - les rubriques sont imposées : « pipi » n'a pas de sens pour un bébé ni
     pour un enfant de 8 ans, et il touche à l'intime ;
   - côté parent, la consultation est pauvre : des icônes dans des cartes
     étroites et un récap en comptes bruts, sans comparaison d'une semaine à
     l'autre ;
   - l'assistant ne voit pas le semainier : aucun outil MCP ne le lit ni ne
     l'écrit, ce qui contredit la vision « on consulte dans l'app, on saisit
     par l'assistant » ;
   - aucun lien avec l'agenda, alors que les événements peuvent déjà être
     assignés à un enfant (`EventAssignee.profileId`) ;
   - aucun moyen de transmettre la semaine à la nounou, à la crèche ou aux
     grands-parents, alors que c'est la promesse du persona 3 dans
     `PRODUCT.md` ;
   - visuellement : 7 couleurs d'arc-en-ciel et des cartes, loin des aplats
     francs et de l'en-tête compact de la v2.

## 2. Features proposées

Classement par score ICE (impact x confiance / effort, chacun de 1 à 5).

| # | Feature | Impact | Confiance | Effort | ICE | Verdict |
|---|---------|:-:|:-:|:-:|:-:|---|
| F1 | Vue semaine en un coup d'œil (parent) | 5 | 4 | 2 | 10 | Faire (MVP) |
| F2 | Rubriques choisies par enfant | 4 | 4 | 2 | 8 | Faire (MVP) |
| F3 | Semainier dans l'assistant (outils MCP) | 4 | 4 | 2 | 8 | Faire (MVP) |
| F4 | Transmettre la semaine (texte à partager) | 3 | 3 | 1 | 9 | Backlog, juste après |
| F5 | L'agenda de l'enfant dans le jour | 3 | 3 | 2 | 4,5 | Backlog |
| F6 | Tendances sur 4 semaines | 3 | 2 | 3 | 2 | Backlog |
| F7 | Rappel du soir | 2 | 2 | 2 | 2 | Backlog, opt-in |
| F8 | Routines et étoiles | 3 | 2 | 5 | 1,2 | Adapter, plus tard |

F4 a un bon ICE mais dépend de F1 (même résumé, autre sortie) : il la suit
plutôt qu'il ne la précède. Le « résumé hebdo généré » n'est pas une feature
de l'app : il passe par F3 (l'assistant lit la semaine et la résume), sans
LLM embarqué ni nouveau tiers.

### F1. Vue semaine en un coup d'œil

- **Problème** : un parent qui rentre le soir, ou la personne qui récupère
  l'enfant, veut savoir en trois secondes comment s'est passée la semaine.
  Aujourd'hui il faut ouvrir les jours un par un ou le récap.
- **Pour qui** : parents, nounou ou grand-parent membre du groupe. Moment :
  le soir, téléphone en main.
- **Ce que c'est** : un tableau dont les lignes sont les rubriques suivies et
  les colonnes les 7 jours ; une case vide reste visiblement vide. Sous le
  tableau, une ligne de bilan en texte simple (« 4 siestes sur 5 jours
  remplis », « activité la plus fréquente : parc »). Elle remplace les 7
  cartes et la surimpression « Récap » en mode parent. Le mode enfant garde
  de grands boutons.
- **Critères d'acceptation** :
  - sur un écran de 375 px de large, les 7 jours et toutes les rubriques
    suivies tiennent sans défilement horizontal ;
  - aujourd'hui est repéré sans dépendre de la couleur seule (texte ou
    contour) ;
  - un appui sur une case ouvre l'éditeur de ce jour, sur la rubrique
    touchée ;
  - chaque icône a un libellé accessible (lecteur d'écran : « mardi, humeur :
    content ») ;
  - la ligne de bilan ne compte que les jours remplis et l'écrit (« sur 5
    jours remplis ») ; aucune formulation d'alerte ou d'interprétation
    (pas de « mauvaise semaine ») ;
  - les règles du mode enfant restent vraies (ré-appui, fond, libellés).
- **Données** : aucune migration. L'API `GET /api/kids` suffit.
- **Assistant** : consultation. La même synthèse sert de base à l'outil de
  lecture de F3.

### F2. Rubriques choisies par enfant

- **Problème** : un bébé n'a pas d'activités « puzzle », un enfant de 8 ans
  n'a plus de sieste ni de suivi pipi. Imposer les cinq rubriques remplit
  l'écran de questions inutiles et collecte des données qu'on n'a pas
  demandées.
- **Pour qui** : le parent qui configure ; l'enfant y gagne un écran plus
  court.
- **Ce que c'est** : dans la fiche de l'enfant (le dialogue « Renommer »
  existant, ou les réglages du semainier), une liste d'interrupteurs :
  météo, humeur, activités, sieste, pipi. Plus tard, choisir les activités
  proposées (garder les 12 par défaut au départ).
- **Critères d'acceptation** :
  - un enfant déjà existant garde exactement ses rubriques actuelles (toutes
    actives) : aucune donnée ni aucun affichage ne disparaît ;
  - un nouvel enfant démarre avec météo, humeur et activités ; sieste et
    pipi sont proposés mais désactivés tant que le parent ne les active pas ;
  - désactiver une rubrique la masque partout (éditeur, mode enfant, vue
    semaine, bilan, assistant) sans effacer les saisies passées ; la
    réactiver les fait réapparaître ;
  - le réglage est partagé par tout le groupe (il appartient à l'enfant,
    comme le semainier) ;
  - au moins une rubrique reste active.
- **Données** : migration. Un champ sur `FamilyProfile`, par exemple
  `kidFields String @default("[\"weather\",\"mood\",\"activities\"]")`, plus
  un backfill qui met les cinq rubriques sur les enfants existants. À ajouter
  à l'export de compte. Suivre `docs/migrations-prisma.md` ; le changement
  touche aux profils du foyer, donc `npm run build && npm run
  test:ownership`.
- **Assistant** : consultation (l'outil de lecture ne renvoie que les
  rubriques actives) ; l'écriture refuse une rubrique désactivée avec un
  message clair.
- **App Store** : c'est la réponse à la question ouverte. Oui, l'utilisateur
  choisit ce qu'il suit, et rien de sensible n'est actif par défaut.

### F3. Le semainier dans l'assistant

- **Problème** : la vision est de consulter dans l'app et de saisir par
  l'assistant. Aujourd'hui le semainier est le seul module de la boucle
  famille absent du serveur MCP.
- **Pour qui** : le parent qui reçoit le compte rendu de la crèche ou de la
  nounou et veut le noter en une phrase (« Léa a fait la sieste, peinture et
  parc, plutôt contente ») ; le parent qui demande « comment s'est passée la
  semaine de Léa ? ».
- **Ce que c'est** : deux outils dans `minddump-mcp/` :
  - lecture : la semaine (ou une période courte) d'un enfant, rubriques
    actives seulement, avec les libellés français ;
  - écriture : la journée d'un enfant, champs partiels, en réutilisant les
    identifiants existants (`sunny`, `happy`, `park`…).
- **Critères d'acceptation** :
  - l'enfant se désigne par `profileId`, obtenu via l'outil des groupes qui
    liste déjà les enfants ;
  - l'outil refuse un profil auquel l'utilisateur n'a pas accès, avec le
    même contrôle que l'API (`findAccessibleProfile`) ;
  - une valeur inconnue (« activité : judo ») est refusée avec la liste des
    valeurs acceptées, jamais enregistrée telle quelle ;
  - l'écriture partielle ne touche pas aux autres rubriques du jour ;
  - la période lue est bornée (31 jours maximum) ;
  - la saisie faite par l'assistant apparaît dans l'app sans rechargement
    manuel au retour sur la page.
- **Données** : aucune migration.
- **Assistant** : lecture et écriture. Le résumé hebdo « généré » vient de
  là, sans rien ajouter à l'app.
- **Risque** : les données de l'enfant transitent alors par l'assistant que
  l'utilisateur a connecté (Claude ou autre client MCP). C'est son choix, mais
  `/confidentialite` doit le dire pour ce module comme pour les autres.

### F4. Transmettre la semaine

- **Problème** : la promesse du persona 3 est de transmettre entre parents,
  nounou et grands-parents. Inviter la nounou dans le groupe lui ouvre tout
  le foyer (courses, agenda, tâches).
- **Pour qui** : le parent ; destinataires hors app.
- **Ce que c'est** : un bouton « Partager la semaine » qui produit un texte
  court (le bilan de F1, jour par jour) et ouvre la feuille de partage du
  téléphone (SMS, WhatsApp, mail). Pas de lien public.
- **Critères d'acceptation** : texte en français simple, sans icône
  indispensable à la lecture ; ne contient que les rubriques actives ; rien
  n'est envoyé sans geste explicite ; sur ordinateur, le texte est copié.
- **Données** : aucune migration, aucun stockage.
- **Assistant** : sans objet (l'assistant sait déjà résumer via F3).
- **Ne pas faire** : lien public consultable sans compte, compte « invité
  nounou » limité au semainier. À rediscuter seulement si le besoin revient.

### F5. L'agenda de l'enfant dans le jour

- **Problème** : « piscine le mercredi » est déjà dans l'agenda, assigné à
  l'enfant, mais le semainier l'ignore.
- **Pour qui** : parent et enfant.
- **Ce que c'est** : dans l'éditeur du jour et dans la vue semaine, les
  événements assignés à l'enfant ce jour-là, en lecture seule. Pas de
  pré-cochage automatique d'activité : l'événement prévu n'est pas la
  preuve qu'il a eu lieu.
- **Critères d'acceptation** : seuls les événements visibles par
  l'utilisateur et assignés à ce profil apparaissent ; un appui ouvre
  l'événement ; en mode enfant, affichage seulement (titre et heure), aucune
  modification possible.
- **Données** : aucune migration (`EventAssignee.profileId` existe).
- **Assistant** : rien de neuf (le calendrier est déjà exposé).

### F6. Tendances sur 4 semaines

- **Problème** : savoir si les siestes se raréfient ou si l'humeur change
  depuis la rentrée.
- **Pour qui** : parents.
- **Critères d'acceptation** : 4 semaines glissantes, une ligne par rubrique
  active, jours non remplis exclus et signalés ; aucune moyenne présentée
  comme une note de l'enfant ; aucun message d'alerte ni conseil.
- **Données** : aucune migration (l'API accepte déjà `from` / `to`).
- **Assistant** : consultation via F3 (« compare avec le mois dernier »).
- **Risque** : glisser vers un outil de surveillance ou de diagnostic. Le
  ton doit rester celui d'un carnet, pas d'un tableau de bord médical.

### F7. Rappel du soir

- **Problème** : on oublie de remplir, et une semaine à trous perd son
  intérêt.
- **Pour qui** : un parent qui l'active ; jamais l'enfant.
- **Critères d'acceptation** : désactivé par défaut ; heure choisie ; pas de
  notification si la journée est déjà remplie ; un seul membre ou tous,
  au choix ; s'appuie sur l'envoi existant (`src/lib/notify.ts`).
- **Données** : migration légère (préférence de rappel).
- **Assistant** : sans objet.

### F8. Routines du matin et du soir, étoiles

- **Problème** : « s'habiller, dents, cartable » répété chaque matin.
- **Pour qui** : enfant de 3 à 8 ans, parent.
- **Verdict : adapter, plus tard.** C'est un autre produit (liste de tâches
  enfant, récurrence quotidienne, éventuelles récompenses) avec ses propres
  modèles de données. Les étoiles posent une question éducative que
  MindDump n'a pas à trancher pour les familles. Si le besoin se confirme,
  partir d'une simple checklist du jour en mode enfant, sans points ni
  classement.
- **Données** : nouveaux modèles (routine, étapes, coches par jour).
- **Assistant** : édition des routines par l'assistant, consultation dans
  l'app.

## 3. Risques

- **RGPD et données d'enfants** : humeur, sommeil et propreté d'un enfant
  identifié par son prénom. Pas forcément des « données de santé » au sens
  de l'article 9 pour la météo ou les activités, mais sieste et pipi s'en
  approchent. Réponse proposée : minimisation (F2, sensible désactivé par
  défaut), aucun tiers ajouté, export et suppression déjà couverts
  (`docs/rgpd.md`), et mise à jour de `/confidentialite` pour le réglage des
  rubriques et l'accès par l'assistant. Un avis juridique reste à prendre si
  l'app vise le grand public ; je ne tranche pas la qualification.
- **App Store et Play Store** : pas d'intégration HealthKit ni Health
  Connect, et il n'en faut pas. Dans l'étiquette de confidentialité, déclarer
  ces données comme du contenu saisi par l'utilisateur, lié au compte, non
  utilisé pour du suivi ni de la publicité. Ne pas présenter le semainier
  comme un outil de santé ou de suivi du développement dans la fiche ; ne
  pas classer l'app dans la catégorie Enfants (l'app s'adresse aux parents ;
  le mode enfant est un écran sous contrôle parental). Formulation à faire
  vérifier au moment de la soumission (phase 4).
- **Vocabulaire** : déjà acté (`docs/landing-page/03-axe-rendez-vous-administratif.md`) :
  aucune allusion à un suivi médical. Pas de « santé », « développement »,
  « surveillance », « alerte ».
- **Complexité** : le semainier est « anecdotique pour la majorité de
  l'audience » (`docs/landing-page/01-marketing.md`) et passe dans « Plus »
  sur mobile. Il ne doit pas devenir un deuxième produit : routines,
  récompenses et partage externe avec comptes invités restent hors MVP.
- **Mode enfant contre vision « consulter »** : le mode enfant est une
  exception assumée. C'est l'enfant qui saisit, et c'est le cœur du jeu.
  L'édition par l'assistant vaut pour le parent, pas pour l'enfant.

## 4. MVP recommandé avec la refonte visuelle

1. **F1, vue semaine en un coup d'œil** : c'est la refonte elle-même côté
   parent (consultation d'abord, aplats, en-tête compact) ; elle remplace
   les cartes et le récap.
2. **F2, rubriques choisies par enfant** : seule migration du lot, elle
   répond à la question App Store et réduit la collecte.
3. **F3, outils MCP lecture et écriture** : petit effort, déploiement séparé
   du serveur MCP, et c'est ce qui aligne le semainier sur la vision.

Le mode enfant est redessiné en même temps (aplats, grands boutons
libellés, semaine en cours), sans nouvelle fonction. F4 à F8 vont au
backlog (`docs/backlog.md`).

Ce qu'on ne fait pas dans le MVP : tendances, rappels, routines, étoiles,
partage externe, lien agenda, note libre par jour (texte libre = données
non maîtrisées sur un enfant), activités personnalisées.

## 5. Indicateur de réussite

Hypothèse à vérifier sur le foyer d'Alexandre et les proches, pas une
promesse : sur 4 semaines après livraison, part des jours remplis par enfant
suivi, et nombre de saisies faites par l'assistant. Si les jours remplis ne
progressent pas, F7 (rappel) remonte en priorité.
