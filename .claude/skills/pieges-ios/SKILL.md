---
name: pieges-ios
description: Réservé à l'agent mobile de MindDump. Pièges iOS/WebKit déjà rencontrés sur MindDump (WKWebView de la coque Capacitor, Safari, PWA) et vérifications à faire avant de déclarer un changement d'interface bon sur iPhone et iPad.
user-invocable: false
---

# Pièges iOS / WebKit de MindDump

La coque Capacitor charge https://minddump.fr dans un WKWebView : le moteur
est celui de la version d'iOS de l'appareil, pas un Chrome récent. Tout ce
qui suit a déjà cassé en production ; le vérifier à chaque changement qui
touche le domaine concerné.

## CSS récent sans repli

- **`color-mix()`** : absent avant iOS 16.2. Les variables qui l'utilisent
  deviennent invalides et le texte peut disparaître. Toujours un repli
  `@supports not (color: color-mix(in srgb, red, red)) { … }` lisible
  (exemple : `.ev-chip` dans `src/app/globals.css`).
- Même réflexe pour toute fonction CSS récente (`:has()`, `@container`,
  unités `dvh`/`svh`, `text-wrap`, nesting natif) : vérifier la version
  d'iOS qui l'apporte et prévoir un rendu acceptable sans elle.

## Dates et heures

- **Ne jamais** écrire `new Date("2026-10-09T17:05")` : une chaîne sans
  fuseau ne se lit pas de la même façon selon le moteur. Utiliser
  `localDateTime(date, time)` (`src/lib/todoDue.ts`) et les lecteurs de
  `src/lib/dateInput.ts`. Tests : `npm run test:date-input` (5 fuseaux).
- **Hydratation** : une heure, une date, « aujourd'hui » ou une salutation
  calculées au rendu serveur (UTC en production) puis au client (Paris)
  donnent les erreurs React #418 / #423 / #425. Démarrer à `null` et
  calculer au montage (exemple : horloge de `src/app/wall/[token]/WallScreen.tsx`).
- Champs `type="date"` / `type="time"` natifs : vérifier qu'ils restent
  lisibles et utilisables au doigt.

## Clavier virtuel et formulaires

- La barre d'accessoires iOS (flèches, « OK ») et le clavier réduisent la
  hauteur visible : après une erreur, donner le focus au champ fautif avec
  `focus({ preventScroll: true })` puis `scrollIntoView({ block: "center" })`
  après un tour de rendu (exemple : `focusField` dans
  `src/app/kids/TrackerForm.tsx`).
- Message d'erreur dans un conteneur `aria-live` toujours présent, pas un
  `role="alert"` monté à la volée (annonce manquée par VoiceOver).
- Police des champs ≥ 16 px, sinon Safari zoome à la saisie.

## Gestes

- **Clic fantôme** : à la fin d'un appui long ou d'une fermeture, iOS peut
  envoyer un `click` à l'élément qui se retrouve sous le doigt. Avaler
  **seulement le premier** clic dans un court délai (`swallowClicks`,
  `GHOST_CLICK_MS = 400` dans `src/app/kids/KidMode.tsx`), jamais tous.
- Aucune action accessible uniquement au survol ; cibles ≥ 44 px.

## Plein écran

- L'API Fullscreen est préfixée (`webkitRequestFullscreen`,
  `webkitFullscreenElement`, `webkitfullscreenchange`) et **absente sur
  iPhone** : seule la PWA installée sur l'écran d'accueil est en plein
  écran. Prévoir l'aide « Ajouter à l'écran d'accueil » (exemple :
  `src/app/wall/[token]/FullscreenToggle.tsx`).
- iPadOS 13+ se présente comme un Mac : le reconnaître à
  `navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1`.

## Coque native

- Écran de lancement : sur iOS, attendre la fin du chargement du document
  (et des premières images) et garder la surcouche si une nouvelle
  navigation démarre (`mobile/ios/App/App/WebAuthPlugin.swift`).
- Rappels locaux : demander l'autorisation avant de programmer, heure de
  Paris, pas de rafale de rappels périmés au réveil de l'app.
- Changement natif → nouveau build stores ; changement web → rien à publier.

## Vérification minimale

1. Captures à 390 px (iPhone) et 820 px (iPad) en clair et en sombre ; le
   parcours Playwright `tests/kids-ui.e2e.mjs` sert de modèle.
2. Simulateur iOS si disponible, idéalement sur la plus vieille version
   d'iOS supportée pour tout CSS récent.
3. Console sans erreur d'hydratation.
4. Dire explicitement ce qui n'a pas été vérifié sur un vrai appareil.
