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
| 2.2 | Appareils connectés (liste, révocation) | S | ☐ |
| 3.1 | Projet Capacitor (iOS + Android) | M | ☐ |
| 3.2 | Branchement de la connexion mobile | S | ☐ |
| 3.3 | Push natif (APNs / FCM) | L | ☐ |
| 3.4 | Extension de partage iOS + intent Android | M | ☐ |
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

- [ ] Prisma : `MobileDevice` (`userId`, `name`, `platform`, `createdAt`,
      `lastSeenAt`, `revokedAt`) créé à l'échange ; l'id est porté dans le JWT.
- [ ] `/profile` : liste des appareils, révocation (le callback `jwt` refuse un
      appareil révoqué).
- [ ] La suppression de compte et l'export RGPD les incluent.

---

## Phase 3 — Coque Capacitor

### 3.1 Projet Capacitor

- [ ] Dossier `mobile/` (package séparé, comme `minddump-mcp/`) : Capacitor,
      plateformes `ios/` et `android/`.
- [ ] `capacitor.config.ts` : `server.url = "https://minddump.fr"`,
      `allowNavigation` limité à minddump.fr ; liens externes ouverts dans le
      navigateur système.
- [ ] `mobile/www/index.html` : écran de repli si le site est injoignable au
      premier lancement.
- [ ] iOS : `WKAppBoundDomains` (minddump.fr) et
      `limitsNavigationsToAppBoundDomains`, **nécessaires pour que le service
      worker fonctionne dans WKWebView**.
      ⚠️ Dès que cette clé existe, iOS n'autorise l'injection de script
      (`evaluateJavaScript`, user scripts, message handlers) que sur les
      domaines listés, dans **toutes** les WebViews de l'app, et échoue sans
      erreur ailleurs. Y ajouter `supermarchesmatch.fr` et
      `api-drive.drive.supermarchesmatch.fr` pour l'étape 3.6 (10 domaines
      maximum).
- [ ] Côté web : `src/lib/native.ts` (`isNativeApp()`), pour masquer
      l'invitation à installer, le bouton Web Push, etc.
- [ ] Icônes et écran de lancement générés depuis l'icône existante.
- [ ] `docs/app-mobile-build.md` : build iOS / Android en local.

**Validation** : l'app tourne sur simulateur iOS et émulateur Android ;
connexion par identifiants OK ; mode avion → la PWA hors ligne prend le relais.

### 3.2 Branchement de la connexion mobile

- [ ] Schéma `minddump://` (iOS `CFBundleURLTypes`, Android intent-filter).
- [ ] Boutons Google / Apple de `LoginMethods.tsx` / `OAuthButtons.tsx` : dans
      l'app, ouvrent le flux 2.1 via `ASWebAuthenticationSession` (iOS) / Custom
      Tabs (Android) au lieu de la redirection NextAuth.
- [ ] Liaison / déliaison de compte depuis `/profile` : même mécanisme.

### 3.3 Push natif

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

- [ ] iOS : Share Extension (Swift) qui accepte une URL ou du texte et ouvre
      `minddump://partager?url=…` → page `/partager` (étape 1.5).
- [ ] Android : intent-filter `ACTION_SEND` `text/plain` → même page.

**Validation** : Safari / app HelloFresh → Partager → MindDump importe la recette.

### 3.5 Finitions natives

- [ ] Barre d'état et écran de lancement suivant le thème clair / sombre.
- [ ] Bouton retour Android (historique WebView, puis sortie).
- [ ] Retour haptique en cochant un todo ou un article.
- [ ] Photo de recette : `<input type="file" accept="image/*" capture>` (ou
      plugin Camera) dans `RecipeView.tsx`.
- [ ] Clavier : pas de zoom sur les champs (police ≥ 16 px), champs non masqués.
- [ ] Plus tard, si besoin : widget « liste de courses ».

### 3.6 Remplir le panier drive Match

Partie serveur sur la branche `feat/drive-match` (autre session) :
correspondances article → produit Match, `GET /api/drive/match/plan?listId=…`
(format à confirmer). L'API interne de Match est derrière Cloudflare et ne
répond qu'à un vrai navigateur, jamais au serveur : l'ajout au panier doit
partir de l'appareil. Rien de possible en PWA.

- [ ] Deuxième WebView dédiée à `supermarchesmatch.fr` (plugin type
      `@capgo/inappbrowser` ou petit plugin maison), avec injection de script
      et retour de messages vers l'app. La WebView principale reste limitée à
      minddump.fr.
- [ ] L'utilisateur se connecte à son compte Match dans cette WebView ; l'app
      injecte l'ajout groupé du plan au panier, puis le laisse valider et payer
      lui-même.
- [ ] Domaines Match dans `WKAppBoundDomains` (voir 3.1).

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
