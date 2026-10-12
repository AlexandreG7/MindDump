# Refonte de l'app connectée : direction visuelle (v2, « l'atelier, côté cuisine »)

Statut : v2 appliquée sur l'accueil, les tâches, les listes de courses et la navigation. La v1 (cartes douces, teintes timides) était trop sage ; la v2 reprend le langage de la landing v2 (aplats francs, gros titres, formes), en gardant une app d'usage quotidien. À valider par captures avant tout push.

## Problème en une phrase

L'app était correcte mais interchangeable ; elle sert pourtant en cuisine et au magasin, le téléphone dans une main, et doit avoir une identité aussi forte que la landing sans ajouter de friction.

## Principes

1. **Audace dans la forme, pas dans la friction.** Aplats francs par module, titres en Plus Jakarta Sans 800 (`font-display`, interligne serré), chiffres géants. Les gestes restent ceux d'avant : un appui coche, une icône supprime.
2. **Une couleur franche par module.** Tâches orange, Courses vert, Repas safran, Agenda bleu. Jetons `--tone-*` (aplat), `-soft` (fond doux), `-ink` (texte), `--on-tone` (texte sur aplat, toujours encre foncée, 6:1 à 11:1).
3. **Mobile d'abord.** Cibles de 44 à 48 px, safe areas, dock flottant, clair et sombre.
4. **Secondaires discrets, jamais cachés.** Icônes `h-3.5 w-3.5` au survol, `touch:opacity-100`, cible de 48 px, `aria-label`. Le glisser pour cocher/supprimer est un raccourci, jamais le seul accès.
5. **Pas de manuscrit** dans l'app (Caveat reste réservé à la landing).

## Identité

- **En-têtes de module** (`ui/module-hero.tsx`) : grand aplat de la teinte du module, titre display, compteur animé, formes SVG qui dérivent à peine. Remplace `page-header` (supprimé).
- **Accueil** : carte sombre « Bonjour … » avec scène de quatre collines (`dashboard/DayScene.tsx`, SVG inline, aucune image) puis « Ta journée ».
- **Fond** : papier chaud `36 33% 97%` en clair, uniquement sous `body.app-skin` (classe posée par la barre de navigation une fois connecté). La landing, la connexion et les pages publiques gardent le fond d'origine (vérifié : `/` déconnecté, fond `#F9FAFB`).
- **Surfaces d'encre** (`--surface-ink`) : champs d'ajout rapide, dock, barre latérale.

## Navigation

- **Mobile : 5 onglets + « Plus » (6 emplacements)** : Accueil, Tâches, Agenda, Listes, Recettes, Plus. Justification : ce sont les 5 usages quotidiens, Recettes est utile en cuisine, et 6 emplacements de ~59 px restent au-dessus de 44 px avec libellé. Semainier, profil et groupes passent dans « Plus ».
- Dock flottant sombre ; une pilule glisse sous l'onglet actif, à l'aplat de son module.
- **Bureau** : barre latérale sombre arrondie, onglet actif à l'aplat du module.

## Mouvement

Sobre mais vivant, `transform` et `opacity` seulement (sauf le trait barré, qui dessine un `background-size`).

- Ressorts calculés (`--spring-soft`, `--spring-pop`, `linear()` avec repli Bézier), 520 à 900 ms sur les éléments décoratifs, ≤ 260 ms sur les retours d'action.
- Case cochée : ressort ; trait barré qui se dessine ; compteurs à rouleaux (`ui/animated-number.tsx`, inspiré de React Bits « Counter », réécrit sans dépendance).
- Réorganisation des listes en FLIP (`ui/flip-list.tsx`), glisser pour cocher/supprimer (`ui/swipe-row.tsx`).
- `prefers-reduced-motion` : plus de dérive, plus de ressorts, plus de FLIP ; les états changent sans mouvement.
- Aucune dépendance ajoutée : pas de GSAP (inutile ici), pas de Lenis (interdit dans l'app).

## Poids

First Load JS, par rapport à la v1 : `/` +4 kB, `/todos` +4 kB, `/lists` +7 kB, `/calendar` -1 kB, `/recipes` inchangé, `/login` inchangé. Chaque page reste sous +10 kB.

## Reste à décliner

Agenda, recettes (fiche et mode cuisine), profil et groupes utilisent encore les composants v1 recolorés par les nouveaux jetons.
