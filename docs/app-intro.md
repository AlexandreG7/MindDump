# Animation d'ouverture de l'app

Jouée dans l'app (agent utilisateur `MindDumpApp/`) au démarrage à froid, une
seule fois par lancement (`sessionStorage` `minddump-app-intro`). Jamais sur le
site ni dans la PWA. Code : `src/lib/appIntro.ts`, `src/components/AppIntro.tsx`,
bloc `.app-intro` de `src/app/globals.css`, script dans `src/app/layout.tsx`.

## Première image (à reproduire à l'identique dans l'écran de lancement natif)

| | Clair | Sombre |
|---|---|---|
| Fond | `#F8F7F5` | `#212226` (= colorset `AppBackground`) |
| Logo | tuile `#F97316`, « M » blanc | idem |

- Logo : 96 x 96 pt, **centré sur l'écran entier** (pas sur la zone sûre), même
  dessin que `src/app/icon.svg` (viewBox 32, rx 8, soit un rayon de 24 pt, trait du
  M de 3,5/32 = 10,5 pt, bouts arrondis).
- Taille fixe en points quel que soit l'appareil et l'orientation (pas de
  `scaleAspectFill`).
- Les couleurs suivent le thème du **téléphone**, pas un thème forcé dans l'app.

Écart constaté dans l'existant : `Splash` clair a un logo de 360 px sur 2732 et
`Splash` sombre de 820 px (soit 111 pt et 253 pt sur iPhone 390 x 844 en
`scaleAspectFill`), et le fond sombre du PNG est `#202225` au lieu de `#212226`.

## Séquence (1 000 ms, CSS pur)

0-100 ms image fixe, 100-200 on s'accroupit, 200-640 saut et retournement façon
crêpe (rotateX 360 deg), 640-780 réception et rebond, 780-1000 fondu avec léger
zoom. `prefers-reduced-motion` : image fixe 150 ms puis fondu de 200 ms.
Filet de sécurité : l'overlay est retiré du DOM après 2,5 s au plus.
