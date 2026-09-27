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
| 1.4 | Notifications Web Push | L | ☐ |
| 1.5 | Partage vers MindDump (Android) et invitation à installer | S | ☐ |
| 2.1 | Connexion OAuth par navigateur système (code à usage unique) | M | ☐ |
| 2.2 | Appareils connectés (liste, révocation) | S | ☐ |
| 3.1 | Projet Capacitor (iOS + Android) | M | ☐ |
| 3.2 | Branchement de la connexion mobile | S | ☐ |
| 3.3 | Push natif (APNs / FCM) | L | ☐ |
| 3.4 | Extension de partage iOS + intent Android | M | ☐ |
| 3.5 | Finitions natives | M | ☐ |
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

- [ ] Prisma : modèle `PushSubscription` (`userId`, `endpoint` unique, `p256dh`,
      `auth`, `userAgent`, `createdAt`, `lastUsedAt`), suppression en cascade
      avec `User`.
- [ ] Clés VAPID dans l'env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT`), ajoutées à `.env.example` et à Coolify.
- [ ] Dépendance `web-push`.
- [ ] `POST` / `DELETE /api/push/subscriptions`.
- [ ] Extraire l'envoi de `src/app/api/cron/notify/route.ts` dans
      `src/lib/notify.ts`, avec un canal par type : e-mail, puis Web Push.
      Même liste de destinataires (membres du groupe) ; un 404 ou 410 du service
      push supprime l'abonnement.
- [ ] Préférences par utilisateur (champs `User` : `notifyEmail`, `notifyPush`)
      dans `/profile`.
- [ ] SW : `push` affiche la notification ; `notificationclick` ouvre l'élément
      concerné (`/todos`, `/calendar`…).
- [ ] UI `/profile` : bouton d'activation. Sur iOS hors mode standalone,
      expliquer qu'il faut d'abord installer l'app (Web Push iOS 16.4+ uniquement
      en PWA installée).
- [ ] RGPD : `/confidentialite` (abonnements push, finalité, durée),
      export `/api/users/me/export`, `docs/rgpd.md`.
- [ ] ⚠️ Branche `feat/profils-foyer` (migration `20260927120000_family_profiles`,
      mêmes fichiers RGPD : `src/lib/account.ts`, `/confidentialite`,
      `docs/rgpd.md`) : rebaser dessus si elle est mergée avant, et dater la
      migration `PushSubscription` après la sienne.

**Validation** : un todo avec rappel dans 5 minutes déclenche une notification
sur Android (Chrome) et sur iPhone (PWA installée) ; le clic ouvre le todo ;
un abonnement expiré est nettoyé.

### 1.5 Partage vers MindDump (Android) et invitation à installer

- [ ] `share_target` dans le manifest → page `/partager` qui reconnaît une URL
      HelloFresh / Jow / Quitoque et appelle la route d'import correspondante
      (puis enrichissement HelloFresh automatique) ; sinon propose d'en faire un
      todo.
- [ ] Invitation à installer discrète (`beforeinstallprompt` sur Android,
      courte explication « Partager → Sur l'écran d'accueil » sur iOS), masquable,
      jamais affichée en mode standalone ni dans l'app native.

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
 │ ── ouvre /auth/mobile/start?provider=google&challenge=… ─▶│
 │                         │ connexion Google / Apple ──────▶│
 │                         │◀── redirection minddump://auth?code=… (60 s, usage unique)
 │◀── lien profond ────────┘                                 │
 │ WebView : POST /api/auth/mobile/exchange {code, verifier} ▶│ vérifie, pose le cookie
 │◀─────────────────────────────────── session NextAuth ──────│
```

- [ ] Prisma : modèle `MobileAuthCode` (`codeHash`, `challenge`, `userId`,
      `expiresAt`, `usedAt`).
- [ ] `GET /auth/mobile/start` : garde `challenge` en cookie court, redirige vers
      `/api/auth/signin/<provider>` avec `callbackUrl=/auth/mobile/complete`.
- [ ] `/auth/mobile/complete` : utilisateur connecté (cookie du navigateur) →
      crée le code → redirige vers `minddump://auth?code=…`.
- [ ] `POST /api/auth/mobile/exchange` : vérifie code, expiration, usage unique
      et `sha256(verifier) == challenge` ; encode un JWT NextAuth
      (`encode` de `next-auth/jwt`, même secret, même nom de cookie que
      `src/lib/secureCookies.ts`) et le pose en cookie.
- [ ] Même règle de consentement que le middleware (redirection `/consentement`).
- [ ] `LoginEvent` avec `provider: "google-mobile"` / `"apple-mobile"`.
- [ ] Doc dans `docs/oauth.md`.

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
