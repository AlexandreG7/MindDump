# App mobile : build local

Coque Capacitor dans `mobile/` (voir `docs/app-mobile.md`, phase 3). L'app
charge le site en ligne (`server.url` de `mobile/capacitor.config.ts`) : une
mise à jour déployée sur Coolify arrive dans l'app sans nouvelle version sur
les stores. Seuls les changements natifs (config, plugins, icônes) demandent
un nouveau build.

## Prérequis

- Xcode (26 ou plus), sélectionné comme outil actif :
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- Android Studio (pour Android, étape à venir).
- Node, puis `cd mobile && npm install`.

iOS utilise Swift Package Manager : pas de CocoaPods.

## iOS

```bash
cd mobile
npx cap sync ios          # copie la config et www/ dans le projet Xcode
npx cap open ios          # ouvre Xcode, puis ▶︎ sur un simulateur ou un iPhone
```

En ligne de commande, pour un simulateur :

```bash
cd mobile/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'name=iPhone 17 Pro' \
  -derivedDataPath ../DerivedData build
xcrun simctl install booted ../DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted fr.minddump.app
```

### Tester contre un serveur local

`MINDDUMP_URL` remplace `https://minddump.fr` au moment du `cap sync` :

```bash
npm run build && npm run start -- -p 3110      # à la racine, build de production
cd mobile && MINDDUMP_URL=http://localhost:3110 npx cap sync ios
```

Le simulateur partage le `localhost` du Mac. Le service worker ne tourne
qu'en build de production (pas en `next dev`). **Refaire `npx cap sync ios`
sans `MINDDUMP_URL` avant tout build destiné à un appareil ou aux stores.**

Dans le simulateur, la frappe injectée suit la disposition du clavier du Mac
(AZERTY) : pour remplir un champ, passer par le presse-papiers
(`printf '…' | xcrun simctl pbcopy booted`, puis « Coller »).

## Ce que contient le projet iOS

- `Info.plist` → `WKAppBoundDomains` : `minddump.fr`, `supermarchesmatch.fr`,
  `api-drive.drive.supermarchesmatch.fr` et `localhost` (10 domaines maximum).
  Nécessaire au service worker dans WKWebView ; limite aussi l'injection de
  script (étape 3.6) à ces domaines.
- `appendUserAgent: "MindDumpApp/1"` : le serveur reconnaît l'app
  (`src/lib/native.ts`) ; `/` renvoie alors vers `/login` au lieu de la page de
  présentation. Côté client, `isNativeApp()` masque l'invitation à installer et
  les notifications Web Push (remplacées par le push natif à l'étape 3.3).
- `www/offline.html` : écran de repli (`server.errorPath`) si le site est
  injoignable et que le service worker n'a encore rien en cache.

## Icône et écran de lancement

Générés depuis le dessin de l'icône du site (`src/lib/appIcon.tsx`) :

```bash
npx tsx mobile/scripts/generate-assets.tsx     # depuis la racine du dépôt
```

L'icône est rendue sans canal alpha (exigence de l'App Store).
