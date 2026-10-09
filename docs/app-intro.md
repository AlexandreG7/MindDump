# Animation d'ouverture de l'app

Jouée dans l'app (agent utilisateur `MindDumpApp/`) au démarrage à froid, une
seule fois par lancement (`sessionStorage` `minddump-app-intro`). Jamais sur le
site ni dans la PWA. Code : `src/lib/appIntro.ts`, `src/components/AppIntro.tsx`,
bloc `.app-intro` de `src/app/globals.css`, script dans `src/app/layout.tsx`.

## Première image (à reproduire à l'identique dans l'écran de lancement natif)

L'écran de lancement natif et la première image web (`t = 0`) doivent être
superposables : logo **et message**, au pixel près. Si le site tarde, l'écran
natif reste affiché tel quel, puis le web prend le relais sans saut.

### Fond et logo

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

### Message de chargement

| | Valeur |
|---|---|
| Texte exact | `On prépare ta journée…` (un seul caractère de points de suspension U+2026, pas trois points ; aucune autre variante) |
| Police | police système : San Francisco (SF Pro Text) sur iOS, Roboto sur Android. Pas de police embarquée, pas de manuscrit |
| Taille | 15 pt (iOS) / 15 dp (Android), **fixe** : pas de Dynamic Type ni de `fontScale`, comme le logo |
| Graisse | Medium (500) : `UIFont.systemFont(ofSize: 15, weight: .medium)` |
| Interligne | boîte de 20 pt de haut, une seule ligne, sans retour à la ligne ni troncature |
| Crénage | par défaut (aucun letter-spacing) |
| Couleur clair | `#6B6560` (contraste 5,4:1 sur `#F8F7F5`, AA) |
| Couleur sombre | `#A8A6A1` (contraste 6,5:1 sur `#212226`, AA) |
| Alignement | centré horizontalement sur l'écran entier |
| Position | haut de la boîte de 20 pt à **72 pt sous le centre de l'écran**, soit 24 pt sous le bas du logo (centre + 48) ; le centre de la boîte est à centre + 82 pt |

Le logo ne bouge pas à cause du message : il reste centré sur l'écran, le
message est posé par rapport à ce centre (pas de pile verticale qui décalerait
le logo). Le message ne bouge pas pendant la séquence et disparaît avec la
dissolution finale. Il n'est pas annoncé aux lecteurs d'écran (l'écran natif ne
l'est pas non plus). Constantes : `APP_INTRO_MESSAGE` et `APP_INTRO_COLORS`
(`src/lib/appIntro.ts`), classe `.app-intro-msg` (`globals.css`).

Écart constaté dans l'existant : `Splash` clair a un logo de 360 px sur 2732 et
`Splash` sombre de 820 px (soit 111 pt et 253 pt sur iPhone 390 x 844 en
`scaleAspectFill`), et le fond sombre du PNG est `#202225` au lieu de `#212226`.
Aucun message n'existe aujourd'hui dans ces écrans : un `UILabel` (ou un
`TextView` Android) est à ajouter, le texte ne pouvant pas être cuit dans un PNG
indépendant de la langue et du thème sans risque de décalage.

## Séquence (1 000 ms, CSS pur)

0-100 ms image fixe (logo + message), 100-200 on s'accroupit, 200-620 saut avec
**rotation à plat** (axe Z, un tour complet de 360 deg, comme une crêpe vue de
dessus) puis retombée à 640 ms, 640-780 écrasement à l'atterrissage et rebond,
780-1000 fondu avec léger zoom du logo. Le message reste immobile. Le « M » n'est
jamais retourné ni vu de profil : il tourne dans le plan, et se retrouve la tête
en bas vers le milieu du vol (inévitable pour un tour complet).
`prefers-reduced-motion` : image fixe 150 ms (logo + message) puis fondu de
200 ms, aucun saut. Filet de sécurité : l'overlay est retiré du DOM après
2,5 s au plus.
