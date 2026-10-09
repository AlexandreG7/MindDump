# Plan : MindDump en application mobile

Plan découpé en étapes livrables une par une (une étape ≈ une PR). Chaque étape
laisse minddump.fr dans un état stable et déployable via Coolify.

**Stratégie retenue** : PWA d'abord, puis coque Capacitor qui charge
minddump.fr pour la présence dans les stores. Pas de réécriture native : l'UI
Next.js reste la seule interface à maintenir.

```
Phase 1 — PWA            Phase 2 — Auth mobile      Phase 3 — Capacitor        Phase 4 — Stores
installable, hors ligne  connexion OAuth hors       push natif, partage,       TestFlight, Play,
Web Push                 WebView                    finitions natives          fiches, revue
```

## Suivi

| # | Étape | Taille | Statut |
|---|-------|--------|--------|
| 1.1 | Manifest, viewport, safe-area | S | ☑ (reste : test sur iPhone réel) |
| 1.2 | Service worker et page hors ligne | M | ☑ |
| 1.3 | Listes de courses hors ligne | M | ☑ |
| 1.4 | Notifications Web Push | L | ☑ (reste : clés VAPID dans Coolify, test sur appareils réels) |
| 1.5 | Partage vers MindDump (Android) et invitation à installer | S | ☑ (reste : test sur Android réel) |
| 2.1 | Connexion OAuth par navigateur système (code à usage unique) | M | ☑ (reste : aller-retour Google / Apple réel, avec l'app) |
| 2.2 | Appareils connectés (liste, révocation) | S | ☑ |
| 3.1 | Projet Capacitor (iOS + Android) | M | ☑ |
| 3.2 | Branchement de la connexion mobile | S | ✓ connexion et liaison depuis le profil (vrai Google / Apple à valider en production) |
| 3.3 | Push natif (APNs / FCM) | L | ◐ rappels locaux faits et vérifiés (iOS + Android) ; APNs / FCM à faire |
| 3.4 | Extension de partage iOS + intent Android | M | ◐ Android fait, iOS à faire |
| 3.5 | Finitions natives | M | ☐ |
| 3.6 | Remplir le panier drive Match (WebView dédiée) | M | ☐ |
| 4.1 | Publication App Store | M | ☐ |
| 4.2 | Publication Google Play | M | ☐ |

Tailles : S ≈ une demi-journée, M ≈ 1 à 2 jours, L ≈ 3 jours et plus.

## Décisions à prendre

- [ ] **Identifiant d'app** : proposition `fr.minddump.app` (iOS bundle id et package Android).
- [ ] **Plateformes** : iOS et Android ensemble, ou iOS d'abord ?
- [ ] **Push natif** : FCM pour les deux plateformes (un seul SDK côté serveur,
      `firebase-admin`) ou APNs en direct pour iOS. Proposition : FCM partout.
- [ ] **Comptes** : Apple Developer (99 $/an), Google Play Console (25 $ une fois).

---

## Phase 1 — PWA

Utile seule (installable dès maintenant sur Android et iOS) et réutilisée
telle quelle par la coque Capacitor.

### 1.1 Manifest, viewport, safe-area

**Objectif** : « Ajouter à l'écran d'accueil » donne une vraie app plein écran,
sans contenu masqué par l'encoche ou la barre d'accueil.

- [x] `src/app/manifest.ts` : nom, `short_name`, `start_url: "/"`,
      `display: "standalone"`, `theme_color` / `background_color`, `lang: "fr"`.
- [x] Icônes PNG 192 et 512, plus une variante `maskable`, générées au build
      (`src/app/icons/[name]/route.tsx`) depuis le dessin partagé
      `src/lib/appIcon.tsx`, aussi utilisé par `apple-icon.tsx`.
- [x] `export const viewport` dans `src/app/layout.tsx` : `viewportFit: "cover"`,
      `themeColor` clair / sombre (couleurs dans `THEME_COLORS`, `src/lib/theme.ts`).
      `ThemeContext` réécrit les balises quand l'utilisateur force un thème.
- [x] `appleWebApp` dans `metadata` (`capable`, `statusBarStyle: "default"`, `title`).
- [x] Layout : `h-screen` → `h-dvh` ; `env(safe-area-inset-*)` sur la barre et
      le menu mobiles de `Navbar.tsx`, sur `<main>`, sur `body` (côtés, iPhone en
      paysage) et sur `.lp-root` (landing).

**Validation** : Lighthouse « Installable » au vert ; sur iPhone, installée
depuis Safari, rien n'est caché sous l'encoche ni sous la barre d'accueil ;
thème sombre correct.

### 1.2 Service worker et page hors ligne

**Objectif** : l'app démarre sans réseau et affiche une page claire au lieu de
l'erreur du navigateur.

- [x] `@serwist/next` (compatible Next 14). `next.config.js` → `next.config.mjs`
      (Serwist n'est publié qu'en ESM). `public/sw.js` est généré au build et
      ignoré par git.
- [x] `src/app/sw.ts` : précache des assets du build et de `/hors-ligne` ;
      `NetworkFirst` (5 s) pour les pages et les navigations RSC, sans garder
      les réponses redirigées (une page qui renvoie vers `/login` n'est pas
      mise en cache sous son URL) ; images `/_next/image` et `/uploads/`.
      **Aucune réponse d'API mise en cache** : les exceptions se feront route
      par route (étape 1.3).
- [x] Page `/hors-ligne` (statique, non indexée) servie en repli de navigation.
- [x] Déconnexion et suppression de compte : `signOutAndClear`
      (`src/lib/signOut.ts`) efface les caches listés dans
      `src/lib/offlineCache.ts` avant `signOut`.
- [x] SW désactivé en `next dev` ; configuration « prod » dans
      `.claude/launch.json` (`npm run start`, port 3100) pour le tester.

**Validation** : mode avion → l'app s'ouvre sur la dernière page vue ou sur
`/hors-ligne` ; après déconnexion, plus aucune donnée d'API dans Cache Storage.

### 1.3 Listes de courses hors ligne

**Objectif** : cocher des articles en magasin sans réseau. C'est le cas d'usage
mobile principal.

- [x] SW : `NetworkFirst` (4 s) sur une liste fermée de lectures d'API
      (`OFFLINE_API` dans `src/app/sw.ts`) : `/api/lists`, et aussi
      `/api/auth/session`, `/api/groups`, `/api/features`. **La session est
      indispensable** : sans elle, `useAuth` renvoie vers `/login` dès que le
      réseau manque, ce qui rendait inutilisable hors ligne toute page connectée
      (y compris celles de l'étape 1.2).
- [x] `src/lib/offlineLists.ts` : opérations `check` / `add` / `delete`
      appliquées tout de suite à l'écran, envoyées ou mises en file
      (localStorage) si le réseau manque, rejouées dans l'ordre au chargement de
      la page, à l'événement `online` et au retour au premier plan. Les
      opérations en attente sont aussi rejouées sur les listes lues depuis le
      cache, pour ne pas disparaître au rechargement.
- [x] Rejeu idempotent : `checked` explicite ; suppression d'un article déjà
      supprimé = succès ; un article ajouté porte un id au format cuid généré
      par le client, que `POST /api/lists/[id]/items` accepte (même id rejoué →
      200 sans doublon, id déjà pris par une autre liste → 409).
- [x] Indicateur sous le titre : « Hors ligne · N modifications » ; en ligne
      avec des envois en échec, « Envoi en attente », cliquable pour renvoyer.
- [x] Hors ligne, créer / supprimer une liste et ajouter une recette sont
      masqués ou désactivés (ils ont besoin du serveur).
- [x] Déconnexion : la file est vidée avec les caches (`signOutAndClear`).

**Validation** : hors ligne, cocher 3 articles, en ajouter 1, revenir en
ligne → tout est en base et visible sur un autre appareil du groupe.

### 1.4 Notifications Web Push

**Objectif** : les rappels du cron arrivent en notification, en plus (ou à la
place) de l'e-mail.

- [x] Prisma : modèle `PushSubscription` (`endpoint` unique, `p256dh`, `auth`,
      `userAgent`, `createdAt`, `lastUsedAt`, cascade avec `User`) et
      `User.notifyEmail` (défaut `true`). Migration
      `20260927160000_push_notifications`, datée après celle de
      `feat/profils-foyer` (`20260927120000_family_profiles`).
      Pas de `notifyPush` : le push est actif là où un appareil est abonné.
- [ ] **Clés VAPID dans Coolify** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT`, voir `.env.example`). Sans elles, le push est désactivé
      et la ligne « Sur cet appareil » n'apparaît pas dans le profil.
- [x] `web-push` ; envoi dans `src/lib/push.ts` (TTL 12 h, abonnement supprimé
      sur 404 / 410).
- [x] `POST` / `DELETE /api/push/subscriptions` : endpoint limité aux services
      push des navigateurs (`src/lib/pushEndpoint.ts`, anti-SSRF), clés
      vérifiées (65 et 16 octets), un appareil qui change de compte est
      réattribué. `POST /api/push/test` pour une notification d'essai.
      `GET` / `PATCH /api/users/me/notifications` (préférence e-mail, clé
      publique).
- [x] `src/lib/notify.ts` : destinataires (membres du groupe) et envoi par
      canal. Le cron retente un rappel seulement si des envois ont été tentés et
      qu'aucun n'a abouti ; un rappel sans aucun canal est marqué traité.
- [x] SW : `push` affiche la notification (icône, `tag` pour ne pas empiler) ;
      `notificationclick` ramène une fenêtre ouverte sur la bonne page ou en
      ouvre une (chemins de l'app uniquement).
- [x] Section « Rappels » du profil (`src/components/NotificationSettings.tsx`) :
      e-mail on/off, notifications sur cet appareil, essai. Messages dédiés pour
      iPhone hors écran d'accueil, navigateur sans push, permission refusée.
- [x] Déconnexion : l'appareil est désabonné (serveur puis navigateur).
- [x] RGPD : `/confidentialite` (données, durée, services push, stockage hors
      ligne), `CONSENT_VERSION` → `2026-09-v2`, export (appareils sans endpoint
      ni clés), `docs/rgpd.md`.
- [ ] ⚠️ `feat/profils-foyer` touche aussi `src/lib/account.ts`,
      `/confidentialite` et `docs/rgpd.md` : conflits simples à prévoir au merge
      (ajouts de part et d'autre).

**Validation** : un todo avec rappel dans 5 minutes déclenche une notification
sur Android (Chrome) et sur iPhone (PWA installée) ; le clic ouvre le todo ;
un abonnement expiré est nettoyé.

### 1.5 Partage vers MindDump (Android) et invitation à installer

- [x] `share_target` (GET) dans le manifest → `/partager` (protégée par le
      middleware : un visiteur non connecté y revient après connexion, contenu
      partagé conservé). Un lien HelloFresh / Jow / Quitoque (hôte exact,
      `src/lib/share.ts`) est importé tout de suite par la route d'import
      habituelle, enrichissement HelloFresh compris, puis la recette s'ouvre.
      Sinon, ou si l'import échoue : « Créer une tâche » (titre partagé, lien en
      description).
- [x] `InstallPrompt` en tête du dashboard : bouton « Installer » quand Chrome
      émet `beforeinstallprompt` (capté dès le chargement du module), rappel
      « Partager → Sur l'écran d'accueil » sur Safari iOS. Jamais en mode
      standalone ; fermé une fois pour toutes (`installPromptDismissed`,
      mentionné dans `/confidentialite`).
- [ ] Hors plan, repéré en passant : les routes d'import HelloFresh / Quitoque
      récupèrent côté serveur toute URL contenant le mot « hellofresh » /
      « quitoque » (SSRF). Tâche séparée proposée.

**Validation** : depuis l'app HelloFresh Android, Partager → MindDump importe la
recette.

---

## Phase 2 — Authentification mobile

Dans la coque Capacitor, la WebView garde le cookie NextAuth : identifiants et
API marchent tels quels. Le seul problème est l'OAuth : **Google refuse la
connexion dans une WebView embarquée** (`disallowed_useragent`), et Apple la
déconseille. La connexion passe donc par le navigateur système, puis la session
est transmise à la WebView.

### 2.1 Connexion OAuth par navigateur système

Flux (type PKCE) :

```
App                      Navigateur système             minddump.fr
 │ verifier aléatoire                                       │
 │ ── ouvre /api/mobile-auth/start?provider=google&challenge=… ─▶│
 │                         │ connexion Google / Apple ──────▶│
 │                         │◀── redirection minddump://auth?code=… (60 s, usage unique)
 │◀── lien profond ────────┘                                 │
 │ WebView : POST /api/mobile-auth/exchange {code, verifier} ▶│ vérifie, pose le cookie
 │◀─────────────────────────────────── session NextAuth ──────│
```

- [x] Prisma : `MobileAuthCode` (`codeHash`, `challenge`, `userId`, `provider`,
      `expiresAt`, `usedAt`), migration `20260927180000_mobile_auth_codes`. Pas
      de relation vers `User` (codes de 60 s, purgés à chaque émission ; l'échange
      vérifie que le compte existe) : un conflit de moins dans `schema.prisma`
      avec les autres branches.
- [x] `GET /api/mobile-auth/start` (hors de `/api/auth/*`, capturé par
      NextAuth) : fournisseur OAuth actif et défi S256 valides, défi gardé en
      cookie, puis `/auth/mobile` qui appelle `signIn(provider)`.
- [x] `GET /api/mobile-auth/complete` : session du navigateur requise (sinon
      `/login`), consentement requis (sinon `/consentement`), code émis puis
      redirection `minddump://auth?code=…`.
- [x] `POST /api/mobile-auth/exchange` : code existant, non utilisé, non expiré,
      `sha256(verifier) == challenge` ; toute tentative brûle le code. Cookie de
      session encodé avec `encode` de `next-auth/jwt`, même nom et mêmes
      options que NextAuth.
- [x] `LoginEvent` : pas de doublon, la connexion du navigateur système
      l'enregistre déjà avec le vrai fournisseur.
- [x] Doc dans `docs/oauth.md` (« Connexion depuis l'app mobile »).

**Validation** : testable avant Capacitor avec le fournisseur `test-oidc` et un
faux schéma ; code réutilisé, expiré ou avec un mauvais verifier → refusé.

### 2.2 Appareils connectés

- [x] Prisma : `MobileDevice` (`userId`, `name`, `platform`, `createdAt`,
      `lastSeenAt`), migration `20260927190000_mobile_devices`, sans relation
      vers `User` (comme `MobileAuthCode`). Créé à l'échange du code, avec
      `device: { name, platform }` envoyé par l'app ; son id est porté par le
      jeton (`deviceId`).
- [x] Callback `jwt` : un jeton d'appareil n'est valable que si l'appareil
      existe (une requête par clé primaire, pour les seules sessions de l'app ;
      `lastSeenAt` rafraîchi au plus une fois par heure). Sinon jeton et session
      vides : `useSession` repasse en non connecté, l'API répond 401.
- [x] Révoquer = supprimer la ligne (`DELETE /api/users/me/devices/[id]`) ;
      `current` désigne l'appareil de la session, révoqué par
      `signOutAndClear` à la déconnexion dans l'app (sans effet sur le web).
- [x] Profil : section « Appareils connectés » (`ConnectedDevices`), absente
      tant qu'aucun appareil n'est connecté.
- [x] RGPD : suppression avec le compte (explicite, faute de relation), export,
      `/confidentialite` (données et durée).

---

## Phase 3 — Coque Capacitor

### 3.1 Projet Capacitor

- [x] Dossier `mobile/` (package séparé, comme `minddump-mcp/`), Capacitor
      8.5, iOS en Swift Package Manager (pas de CocoaPods). Exclu du
      TypeScript du site (`tsconfig.json`) et de l'image Docker
      (`.dockerignore`). Identifiant `fr.minddump.app`.
- [x] Plateforme Android (Gradle passé à 9.2.1 pour le JDK 25 d'Android
      Studio), icône adaptative et écran de lancement Android 12+. Vérifié sur
      émulateur Pixel 9 (Android 16) : connexion, session conservée après
      fermeture de l'app, puis en mode avion accueil et listes servis par le
      cache, avec l'indicateur « Hors ligne ».
- [x] Trouvé sur Android : le préchargement de navigation du service worker
      (`navigationPreload`) échouait hors ligne et la WebView le prenait pour
      l'échec de la page (écran d'erreur de Capacitor) alors que le cache
      répondait. Désactivé dans `sw.ts`, explicitement à l'activation car le
      réglage persiste sur les appareils déjà installés.
- [x] `capacitor.config.ts` : `server.url = "https://minddump.fr"`
      (`MINDDUMP_URL` pour un serveur local), `allowNavigation` limité à ce
      domaine, `appendUserAgent: "MindDumpApp/1"`.
- [x] `mobile/www/offline.html` : écran de repli (`server.errorPath`).
- [x] iOS : `WKAppBoundDomains` (minddump.fr, les trois domaines Match de
      l'étape 3.6, localhost) et `limitsNavigationsToAppBoundDomains`. **Vérifié : le
      service worker tourne dans WKWebView.**
- [x] Côté web : `src/lib/native.ts` (`isNativeApp()` côté client,
      `isNativeUserAgent()` côté serveur). Dans l'app : `/` → `/login` au lieu
      de la page de présentation, pas d'invitation à installer, pas de ligne
      Web Push dans le profil (la WebView iOS ressemble à Safari : sans ça,
      l'app proposait de « s'ajouter à l'écran d'accueil »).
- [x] Icône (1024 px, sans alpha) et écran de lancement générés depuis le
      dessin du site : `mobile/scripts/generate-assets.tsx`.
- [x] `docs/app-mobile-build.md` : build iOS en local.
- [x] Trouvé en testant : une navigation dans l'app passe par des charges RSC
      (`_rsc` variable, souvent préchargées) jamais retrouvées hors ligne.
      `sw.ts` met maintenant en cache la page complète en arrière-plan après
      toute charge RSC (préchargements compris, 10 min par page) : les onglets
      sont disponibles hors ligne, dans l'app comme dans la PWA.
- [x] En `next dev`, un service worker laissé par un build de production sur le
      même port est désinscrit au chargement (script inline du layout).

**Validation** : l'app tourne sur simulateur iOS et émulateur Android ;
connexion par identifiants OK ; mode avion → la PWA hors ligne prend le relais.

### 3.2 Branchement de la connexion mobile

- [x] Schéma `minddump://` : iOS `CFBundleURLTypes`, Android intent-filter
      (`VIEW`, `minddump://auth`).
- [x] Boutons Google / Apple (`OAuthButtons.tsx`) : dans l'app,
      `nativeSignIn` (`src/lib/mobileSignIn.ts`) génère le verifier PKCE,
      ouvre `/api/mobile-auth/start` dans le navigateur système, récupère
      `minddump://auth?code=…` et l'échange. iOS : `ASWebAuthenticationSession`
      par un plugin local (`ios/App/App/WebAuthPlugin.swift`, enregistré par
      `MainViewController`) ; Android : Custom Tabs (`@capacitor/browser`) et
      `appUrlOpen` (`@capacitor/app`). Les plugins sont appelés par
      `window.Capacitor.Plugins` : le site n'embarque pas Capacitor.
- [x] `/api/mobile-auth/start` accepte aussi `credentials` (identifiant et mot
      de passe dans le navigateur système), utile pour tester sans fournisseur.
- [x] Vérifié sur Android (émulateur) de bout en bout : bouton → Custom Tabs →
      connexion → retour dans l'app connectée, appareil enregistré. iOS
      (simulateur) : la session système s'ouvre, l'annulation rend la main.
      Le vrai aller-retour Google / Apple reste à faire avec les identifiants
      de production.
- [x] Trouvé en testant :
      - `/login` revient vers `callbackUrl` par `router.push`, qui envoie
        d'abord une requête RSC : elle consommait le code avant la vraie
        navigation (« Connexion expirée »). `/api/mobile-auth/complete` ignore
        maintenant les requêtes RSC.
      - Appelé par `window.Capacitor.Plugins`, `addListener` ne renvoie pas une
        promesse : le bouton restait bloqué après fermeture de l'onglet.
      - Les requêtes du service worker ne portent pas l'agent utilisateur de
        l'app : il mettait en cache la page de présentation sous `/`. L'app
        pose aussi un cookie `minddump-app` (mentionné dans `/confidentialite`),
        reconnu par le serveur comme l'agent utilisateur.
      - iOS affichait « App » dans sa demande de connexion : `CFBundleName`
        corrigé en « MindDump ».
- [x] Liaison / déliaison de compte depuis `/profile` dans l'app
      (`LoginMethods.tsx`, `nativeLinkAccount`, `src/lib/mobileLink.ts`) :
      même circuit que la connexion (navigateur système, PKCE, code à usage
      unique) en mode « lier au compte connecté », **sans nouvelle session**.
      La WebView connectée demande un ticket lié à son `userId`, au
      fournisseur et au défi PKCE (`POST /api/mobile-auth/link-ticket`), le
      navigateur système l'ouvre (`start?mode=link&ticket=…`), et l'`exchange`
      (`link-exchange`) renvoie `linked` / `taken` / `error`. Détail et modèle
      de menace : `docs/oauth.md`. Tests : `npm run test:mobile-link` (aussi
      dans le stage `test` du Dockerfile). Vérifié avec le fournisseur de
      test `test-oidc` (`scripts/test-oidc-server.mjs`) sur **iPhone 17 Pro
      (simulateur)** et **Pixel_9 (émulateur)** : lier, délier, compte déjà
      pris (« déjà lié à un autre compte »), fermeture de la fenêtre
      (« Liaison annulée », bouton libéré). Pas de nouveau build natif.
      Non vérifié : le vrai aller-retour Google / Apple (identifiants de
      production), et la déliaison du dernier moyen de connexion dans l'UI
      native (bouton désactivé, refus serveur couvert par le test).
      Durcissement après audit secops : le GET `start?mode=link` n'engage plus
      rien (page de confirmation au nom du titulaire, e-mail masqué ; seul un
      POST protégé par un cookie `SameSite=Strict` + jeton + `Origin` consomme
      le ticket : anti-fixation de ticket), intention abandonnée effacée,
      refus chez le fournisseur ramené à l'app, 5 tickets actifs au plus,
      déliaison sous verrou. Pas de nouveau build natif.

### 3.3 Push natif

#### Rappels locaux (sans Firebase)

Avant le push natif (APNs/FCM) ci-dessous, une première étape sans dépendance
externe : l'app programme elle-même des notifications **locales**
(`@capacitor/local-notifications`), à partir d'une API qui réutilise
exactement la règle du cron existant (e-mail + push web).

- `src/lib/reminders.ts` : extrait du cron (`src/app/api/cron/notify`) la
  logique « quels rappels, à quelle heure, pour qui », pour que le cron et la
  nouvelle route s'appuient sur une seule règle. `recipientsFor`
  (`src/lib/notify.ts`) reste la source de vérité des destinataires : une
  personne qui n'est plus membre du groupe n'est jamais prévenue, l'auteur le
  reste toujours (docs/adr/0001-les-elements-restent-attaches-a-leur-auteur.md).
- `GET /api/reminders/upcoming` (session de l'utilisateur, cookie de la
  WebView) : les rappels des 30 prochains jours qui concernent l'utilisateur
  connecté, triés par `fireAt`, coupés à 60 (plafond iOS de 64 notifications
  locales en attente). Réponse :
  ```json
  {
    "reminders": [
      {
        "key": "todo-abc123",
        "kind": "todo",
        "itemId": "abc123",
        "title": "Courses",
        "body": "Échéance le 05/10/2026 à 18:00",
        "fireAt": "2026-10-05T16:00:00.000Z",
        "url": "/todos"
      },
      {
        "key": "event-def456-1728000000000",
        "kind": "event",
        "itemId": "def456",
        "title": "Réunion hebdo",
        "body": "Le 12/10/2026 à 09:00",
        "fireAt": "2026-10-12T06:50:00.000Z",
        "url": "/calendar?view=day&date=2026-10-12"
      }
    ],
    "generatedAt": "2026-10-04T21:00:00.000Z"
  }
  ```
  `key` est stable (type + id + date d'occurrence) : le client en dérive un
  id numérique de notification locale, pour pouvoir l'annuler/remplacer sans
  tout reprogrammer à chaque rafraîchissement. `url` est la page à ouvrir au
  tap, identique au lien du push web existant.
- Réglage global `User.notifyReminders` (migration
  `20261004211659_reminders_notify_setting`, additive) : `false` renvoie une
  liste vide. Exposé par `GET`/`PATCH /api/users/me/notifications` (même
  endpoint que `notifyEmail`). Pas encore de réglage par type (todo/événement).
- Tests : `tests/reminders.test.mjs` (`npm run test:reminders`), bloquant au
  déploiement comme `test:ownership` (stage `test` du Dockerfile).

- [x] Plugin `@capacitor/local-notifications` 8.3.1 (Android + iOS SPM) : **nouveau
      build natif nécessaire** (nouvelle version sur les stores). Android :
      `POST_NOTIFICATIONS` et récepteurs dans `AndroidManifest.xml`.
- [x] `src/lib/localReminders.ts` (monté par `NativeDeviceSync`) : au
      démarrage, au retour au premier plan et après chaque modification d'une
      tâche ou d'un événement (`notifyRemindersChanged`), compare
      `/api/reminders/upcoming` aux notifications en attente (annule ce qui a
      disparu, reprogramme ce qui a changé). Ids dérivés de la `key` (FNV-1a).
      Alarmes Android **inexactes** (`isExactNotification: false`, pas de
      permission « Alarmes et rappels ») : la notification peut arriver avec
      quelques minutes de retard (jusqu'à 4 min observées sur l'émulateur,
      plus si l'échéance est lointaine).
- [x] Tap sur la notification : la WebView ouvre `/todos?task=<id>` (la tâche est
      mise en évidence 3 s) ou le jour de l'événement, y compris au démarrage à
      froid. Ce garde-fou `url` commence par `/` (jamais `//`).
- [x] Réglage « Rappels sur ce téléphone » (`NotificationSettings`, profil) :
      désactivé, il annule tout ; autorisation refusée : statut explicite, lien
      « Ouvrir les réglages » sur iOS (`app-settings:`). Sur Android, un lien
      `intent:` n'est pas suivi par la WebView (testé) : seul le chemin
      « Paramètres → Applications → MindDump → Notifications » est indiqué.
      L'autorisation n'est demandée qu'à l'activation, jamais en boucle.

**Vérifié le 06/10/2026** (Pixel_9 API 36 et iPhone 17 Pro iOS 26.3, serveur de
production local, base de test) :

| Critère | Android | iOS |
|---|---|---|
| Notification app en arrière-plan | OK | OK |
| Notification app fermée | OK | OK |
| Tap : ouvre la tâche précise, démarrage à froid | OK | OK |
| Modifier l'heure reprogramme ; cocher / supprimer annule | OK | non testé (même code JS) |
| Tâche assignée à quelqu'un d'autre qui a un compte : pas de rappel | OK | non testé (même code JS) |
| Interrupteur désactivé : tout annulé | OK | OK |
| Autorisation refusée : statut + pas de redemande | OK | OK (+ lien réglages) |
| Événement récurrent : occurrences programmées | OK (31 alarmes) | non testé |
| Tap sur une notification d'événement : jour du calendrier | non testé | non testé |

**Limites connues**

- Rappel fantôme : si une tâche ou un événement est modifié ou supprimé hors de
  l'app (MCP, mur, autre appareil, autre membre du groupe), le rappel local
  déjà programmé reste actif jusqu'à la prochaine ouverture ou retour au
  premier plan de l'app, qui resynchronise.
- Une échéance trop proche (`fireAt` déjà passé) n'a pas de notification locale
  (jamais programmée dans le passé) ; le push web et l'e-mail partent quand même.
- Les titres s'affichent sur l'écran verrouillé, selon les réglages de
  l'utilisateur pour les aperçus de notification.
- Android : alarmes inexactes (retard de 1 à 4 min mesuré, fenêtre jusqu'à
  environ 1 h), choix fait pour éviter `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM`
  (permission spéciale déclarée à Play Console).
- L'autorisation système est demandée à l'activation de l'interrupteur, ou par
  `schedule()` à la première synchronisation après connexion s'il existe des
  rappels (statut indéterminé).
- Déconnexion, session expirée et changement de compte annulent tous les
  rappels en attente (`cancelAllLocalReminders`, sérialisé avec la synchro).

Non vérifié : appareils réels, redémarrage du téléphone (les alarmes Android
survivent via `LocalNotificationReceiver` ; à confirmer sur appareil).

#### Push natif (APNs / FCM)

- [ ] Prisma : `DeviceToken` (`userId`, `token` unique, `platform`,
      `mobileDeviceId`), supprimé à la révocation de l'appareil.
- [ ] Plugin `@capacitor/push-notifications` ; enregistrement du jeton via
      `POST /api/push/devices` (cookie de la WebView).
- [ ] Projet Firebase, clé APNs importée dans Firebase, `firebase-admin` côté
      serveur (compte de service dans l'env).
- [ ] `src/lib/notify.ts` : troisième canal ; jetons invalides nettoyés.
- [ ] Tap sur la notification → la WebView ouvre la bonne page.

**Validation** : même scénario que 1.4, app fermée, sur iPhone et Android réels.

### 3.4 Extension de partage iOS et intent Android

- [x] iOS : extension de partage `MindDumpShare` (Swift, cible
      `fr.minddump.app.share`) qui travaille seule, sans ouvrir l'app (Apple
      ne prévoit pas qu'une extension de partage ouvre son app) : un lien
      HelloFresh / Jow / Quitoque est importé (« Recette importée ✓ »), tout
      autre lien ou texte devient une tâche (« Tâche créée ✓ »), mêmes règles
      que `src/lib/share.ts`. Authentification : jeton `mdt_` lié au
      `MobileDevice`, demandé par l'app une fois connectée
      (`POST /api/mobile-auth/device`, réservé à l'app) et rangé dans le
      trousseau partagé `$(AppIdentifierPrefix)fr.minddump.shared` (plugin
      `ShareAuth`, capacité Keychain Sharing des deux cibles) ; seule son
      empreinte est en base, il est renouvelé à chaque lancement, effacé à la
      déconnexion et révoqué avec l'appareil. Sans jeton : « Connecte-toi dans
      l'app ». Vérifié sur simulateur depuis Safari (lien → tâche, lien
      HelloFresh → recette).
- [x] Android : intent-filter `ACTION_SEND` `text/plain` ; `MainActivity`
      charge `/partager?text=…&title=…` (au démarrage à froid comme app
      ouverte). Vérifié sur émulateur : partage d'un texte avec lien → page
      « Ajouter à MindDump » → tâche créée avec le lien en description.
- [x] Android : photo ou PDF partagé → import IA. Intent-filter `ACTION_SEND`
      `image/*` et `application/pdf` ; `MainActivity` convertit la photo en
      JPEG (HEIC refusé par le serveur), la redresse et la réduit à 2000 px de
      côté, la garde en attente puis charge `/importer?shared=1`, qui la prend
      une seule fois par le plugin `SharedFile` (`take()` → `{ name, mimeType,
      data }` en base64). Page `/importer` et API : `feat/import-ia`. Vérifié
      sur émulateur depuis Fichiers (HEIC 6016 px, 8,7 Mo → JPEG 2000 px,
      244 Ko). iOS : pas de partage d'image vers l'import (la relecture exige
      l'app, qu'une extension ne peut pas ouvrir) ; bouton « Importer » dans
      l'app.

**Validation** : Safari / app HelloFresh → Partager → MindDump importe la recette.

### 3.5 Finitions natives

- [x] Barre d'état et écran de lancement suivant le thème clair / sombre.
      Icônes de la barre d'état réglées par `SystemBars.setStyle` depuis
      `ThemeContext`, y compris quand l'utilisateur force un thème différent
      de celui du téléphone. Fond avant chargement et écran de lancement :
      couleur `AppBackground` (iOS), `@color/app_background` avec `values-night`
      (Android). Écran de lancement refait pour l'animation d'ouverture
      (`docs/app-intro.md`) : logo 96 pt / 96 dp centré et message
      « On prépare ta journée… », identiques à la première image web.
      iOS : `LaunchScreen.storyboard` (images `LaunchLogo`, couleurs
      `AppBackground` et `LaunchMessage`), repris en surcouche par
      `MainViewController` jusqu'à ce que la page ait peint. Android : écran
      système 12+ (`Theme.SplashScreen`, logo `ic_splash_logo`, sans disque,
      retiré sans fondu) puis vue `launch_overlay` posée par `MainActivity`
      jusqu'à la première peinture de la page ; `SystemBars.initialViewportFitValueHint`
      évite le saut de 15 dp de la WebView. Ancienne image `Splash` et
      `drawable*/splash.png` supprimées. **Nouveau build natif requis.**
- [x] Bouton retour Android : page précédente du site, sinon l'app passe en
      arrière-plan (`MainActivity`). `WebView.canGoBack()` ignore les
      navigations internes de Next (history.pushState) : on interroge
      `navigation.canGoBack` dans la page. Gestionnaire du plugin App désactivé.
- [x] Retour haptique en cochant une tâche (page Tâches, accueil) ou un
      article (`nativeHaptic()`, plugin `@capacitor/haptics`).
- [x] Photo de recette : les champs `accept="image/*"` existants suffisent ;
      iOS propose appareil photo ou photothèque (`NSCameraUsageDescription`
      ajouté, sans quoi l'app plantait), Android ouvre le sélecteur de photos.
- [x] Clavier : champs à 16 px sur écran tactile (globals.css, pas de zoom
      iOS) ; Android redimensionne la WebView et garde le champ visible
      (vérifié sur émulateur).
- [ ] Plus tard, si besoin : widget « liste de courses ».

### 3.6 Remplir le panier drive Match

Partie serveur sur main (voir `docs/drive-match.md`) :
correspondances article → produit Match, `GET /api/drive/match/plan?listId=…`. L'API interne de Match est derrière Cloudflare et ne
répond qu'à un vrai navigateur, jamais au serveur : l'ajout au panier doit
partir de l'appareil. Rien de possible en PWA.

- [x] Écran Match natif (plugin `MatchDrive`, `MatchDrivePlugin.swift` et
      `.java`) : seconde WebView plein écran sur `www.supermarchesmatch.fr`,
      boutons « Fermer » et « Remplir le panier ». Les liens hors Match
      partent dans le navigateur. La WebView principale reste sur minddump.fr.
      Bouton panier (dans l'app seulement) dans l'en-tête d'une liste de
      courses.
- [x] Scripts injectés : `drive-extension/page.js` et `content.js` tels
      quels (copiés dans `mobile/www/drive/` par le hook
      `capacitor:copy:before`), plus `www/drive/bridge.js` qui remplace
      `chrome.runtime` : `api` remonte au natif puis à la page MindDump de
      l'app (`src/lib/matchDrive.ts`, session de l'utilisateur, liste blanche
      plan / rank / products pour la liste lancée), `takeFill` rend la liste
      en attente gardée côté natif, `fill` relance. L'utilisateur choisit son
      magasin (et se connecte à Match s'il veut retrouver le panier sur son
      compte), valide la revue, puis paie lui-même sur Match.
      Vérifié sur émulateur Android et simulateur iOS (magasin choisi,
      recherche, revue, 4 produits ajoutés au panier, choix mémorisés).
- [x] Domaines Match dans `WKAppBoundDomains` : `supermarchesmatch.fr`,
      `www.supermarchesmatch.fr` (le script est injecté sur la page www ; on ne
      compte pas sur la couverture des sous-domaines),
      `api-drive.drive.supermarchesmatch.fr` et
      `produits.supermarchesmatch.fr` (recherche Prediggo, appelée par fetch
      depuis la page ; ajouté après un premier essai iOS sans aucun résultat).
      Rappel : iOS n'autorise l'injection de script que sur ces domaines, et
      échoue sans erreur ailleurs (10 domaines maximum).
- [x] Écran de revue : celui de l'extension (plein écran sous 600 px), même règle (`MIN_CONFIDENCE` dans
      `drive-extension/content.js`). Une suggestion
      sous 0,5 de confiance est décochée par défaut, sauf si c'est le produit
      habituel du groupe (« truffe blanche » ne doit pas mettre du jambon à la
      truffe au panier).

Déroulé prévu (API sur main, doc dans `docs/drive-match.md` ; auth par cookie de
session, ou `Authorization: Bearer <clé API>`) :

1. `GET /api/drive/match/plan?listId=…` → articles non cochés, avec `query` (texte
   à chercher sur Match) et `remembered` (dernier produit choisi par le groupe).
2. Dans la WebView Match (Cloudflare et CORS l'imposent) : recherche
   `POST https://produits.supermarchesmatch.fr/pred/simplePageContent`, en
   gardant les slots `_type === "produit"`.
3. `POST /api/drive/match/rank { listId, items: [{ itemId, candidates }] }` →
   jusqu'à 5 suggestions par article (confiance, quantité, `needsReview`). Le
   classement se fait côté serveur ; limites : 30 candidats, 100 articles.
4. Ajout au panier dans la page Match, produit par produit, par l'action du
   bouton « Ajouter » du site :
   `useNuxtApp().$store.dispatch("panier/addProduit", { sku, quantite, stats: null })`,
   puis vérification que le panier renvoyé contient bien le SKU. L'ajout groupé
   `panier/addProduits` ne marche pas (panier vide, sans erreur). Voir
   `drive-extension/page.js` et `docs/drive-match.md` ; validé en réel le
   30/09.
5. `PUT /api/drive/match/products { listId, choices }` après un ajout réussi :
   mémorise le choix pour le groupe.

La WebView ne fait que le pont (recherche, ajout au panier) ; le script injecté
est celui de l'extension desktop (`drive-extension/`), réutilisable tel quel.

Liste en attente : comme l'extension (liste rangée dans `storage.session` par
le service worker, car la popup se ferme à l'ouverture de l'onglet Match),
l'app garde la liste à ajouter côté natif et le script injecté la récupère
quand la page Match est prête, plutôt que de la pousser à l'ouverture.

---

## Phase 4 — Publication

### 4.1 App Store

- [ ] Compte Apple Developer, app dans App Store Connect, TestFlight.
- [ ] Étiquettes de confidentialité : e-mail, nom, contenu utilisateur,
      identifiants d'appareil (push) ; aucun suivi publicitaire.
- [ ] Déjà en place : Sign in with Apple (règle 4.8), suppression du compte
      dans l'app (règle 5.1.1(v), `DeleteAccountDialog`), politique de
      confidentialité publique.
- [ ] Notes de revue : compte de démonstration avec des données d'exemple ;
      mettre en avant push, partage, hors ligne (règle 4.2 : l'app ne doit pas
      être une simple coquille autour du site).
- [ ] Captures d'écran (6,9" et 6,5"), description, mots-clés.

### 4.2 Google Play

- [ ] Compte Play Console. **Un compte personnel récent doit faire un test
      fermé avec au moins 12 testeurs pendant 14 jours** avant la production :
      à lancer tôt.
- [ ] Formulaire « Sécurité des données », classification du contenu.
- [ ] AAB signé, fiche, captures.

### Après la publication

- Les changements web (Coolify) arrivent dans l'app sans nouvelle revue.
- Seules les évolutions natives (plugins, extension, config) demandent un
  nouveau build. Automatisation (Fastlane / GitHub Actions) à envisager ensuite.
