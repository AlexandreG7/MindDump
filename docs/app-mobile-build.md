# App mobile : build local

Coque Capacitor dans `mobile/` (voir `docs/app-mobile.md`, phase 3). L'app
charge le site en ligne (`server.url` de `mobile/capacitor.config.ts`) : une
mise à jour déployée sur Coolify arrive dans l'app sans nouvelle version sur
les stores. Seuls les changements natifs (config, plugins, icônes) demandent
un nouveau build.

## Prérequis

- Xcode (26 ou plus), sélectionné comme outil actif :
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- Android Studio, qui fournit le JDK (`jbr`, Java 25) et le SDK
  (`~/Library/Android/sdk`).
- Node, puis `cd mobile && npm install`.

iOS utilise Swift Package Manager : pas de CocoaPods.

## iOS

```bash
cd mobile
npx cap sync ios          # copie la config et www/ dans le projet Xcode
npx cap open ios          # ouvre Xcode, puis ▶︎ sur un simulateur ou un iPhone
```

Signature : choisis ton équipe (Signing & Capabilities) sur les deux cibles,
**App** et **MindDumpShare**, sans committer la ligne `DEVELOPMENT_TEAM` que
Xcode ajoute au projet. L'équipe est nécessaire même sur simulateur : le
groupe de trousseau partagé (`$(AppIdentifierPrefix)fr.minddump.shared`) en
dépend.

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

## Android

```bash
cd mobile
npx cap sync android
npx cap open android      # Android Studio, puis ▶︎ sur un émulateur ou un téléphone
```

En ligne de commande :

```bash
cd mobile/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- Le wrapper Gradle est passé de 8.14 à **9.2.1** : Gradle 8 ne tourne pas sur
  le JDK 25 d'Android Studio (« Unsupported class file major version 69 »).
- `android/local.properties` (chemin du SDK, non versionné) :
  `sdk.dir=/Users/<toi>/Library/Android/sdk`. Android Studio le crée tout seul.
- Serveur local : l'émulateur n'a pas le même `localhost` que le Mac. Utiliser
  `adb reverse tcp:3110 tcp:3110` puis `MINDDUMP_URL=http://localhost:3110`,
  pour que l'URL reste celle de `NEXTAUTH_URL` (cookies de session). Le HTTP
  n'est autorisé que vers `localhost` (`res/xml/network_security_config.xml`).
  Basculer le mode avion de l'émulateur **supprime** la redirection
  `adb reverse` : la refaire ensuite.
- Saisie : `adb shell input text '…'` fonctionne (pas de problème de clavier
  AZERTY comme sur le simulateur iOS) ; `input keyevent 61` (Tab) pour passer
  au champ suivant, le clavier décalant la page.
- `MainActivity` écrit les cookies sur disque au passage en arrière-plan : sans
  ça, une app fermée juste après la connexion perdait sa session.
- `ACCESS_NETWORK_STATE` : sans elle, la WebView laisse `navigator.onLine` à
  `true` et l'app n'affiche jamais « Hors ligne ».
- Icône adaptative : fond orange (`values/ic_launcher_background.xml`) et
  « M » en premier plan ; écran de lancement Android 12+ par l'API SplashScreen
  (`values/styles.xml`), fichiers `splash.png` pour les versions antérieures.

## Ce que contient le projet iOS

- `Info.plist` → `WKAppBoundDomains` : `minddump.fr`, `supermarchesmatch.fr`,
  `api-drive.drive.supermarchesmatch.fr` et `localhost` (10 domaines maximum).
  Nécessaire au service worker dans WKWebView ; limite aussi l'injection de
  script (étape 3.6) à ces domaines.
- `appendUserAgent: "MindDumpApp/1"` : le serveur reconnaît l'app
  (`src/lib/native.ts`) ; `/` renvoie alors vers `/login` au lieu de la page de
  présentation. Côté client, `isNativeApp()` masque l'invitation à installer et
  les notifications Web Push (remplacées par le push natif à l'étape 3.3).
- Cible `MindDumpShare` (`fr.minddump.app.share`) : extension « Partager →
  MindDump », qui importe une recette ou crée une tâche sans ouvrir l'app.
  Elle s'authentifie avec le jeton que l'app range dans le trousseau partagé
  (`SharedKeychain.swift`, compilé dans les deux cibles ; plugin
  `ShareAuth`). Entitlements : `App/App.entitlements` et
  `MindDumpShare/MindDumpShare.entitlements`.
- `www/offline.html` : écran de repli (`server.errorPath`) si le site est
  injoignable et que le service worker n'a encore rien en cache.

## Icône et écran de lancement

Générés depuis le dessin de l'icône du site (`src/lib/appIcon.tsx`) :

```bash
npx tsx mobile/scripts/generate-assets.tsx     # depuis la racine du dépôt
```

L'icône est rendue sans canal alpha (exigence de l'App Store).
