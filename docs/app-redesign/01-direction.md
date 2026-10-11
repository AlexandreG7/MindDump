# Refonte de l'app connectée : direction visuelle

Statut : proposition, appliquée sur l'accueil, les tâches, les listes de courses et la navigation. À valider par captures avant de poursuivre sur les autres écrans.

## Problème en une phrase

L'app est correcte mais interchangeable : cartes blanches à bordure, tout en gris avec un orange timide, cibles de 32 à 40 px, états vides sans action. Elle sert pourtant en cuisine et au magasin, le téléphone dans une main.

## Principes

1. **Lisible à bout de bras.** Texte de ligne à 16 px, titres de page à 28 px, cibles tactiles de 44 à 48 px minimum, une seule action principale par écran.
2. **Une teinte par module.** Tâches : orange. Courses : herbe. Repas : safran. Agenda : bleu. La teinte colore la pastille, la case, le fond doux et le compteur, jamais un grand aplat. Le foyer se repère d'un coup d'œil, sans lire.
3. **Le dynamique vient de la réponse, pas de la décoration.** Retour immédiat au toucher (enfoncement, case qui se remplit, anneau qui avance), pas de parallaxe ni d'effets.
4. **Le foyer est visible.** Qui est concerné (avatars à 24-28 px), pour quand (échéance en langage courant), dans quel groupe (pastille en tête d'accueil).
5. **Secondaires discrets, jamais cachés.** Petites icônes `h-3.5 w-3.5` au survol sur ordinateur, toujours visibles au toucher (`touch:opacity-100`), avec une cible de 44 px et un `aria-label`.

## Typographie

Plus Jakarta Sans, déjà servie par `next/font` : aucun poids ajouté. Pas de manuscrit dans l'app.

| Rôle | Taille / graisse |
|---|---|
| Titre de page | 28/32, 700, interlettrage -0.02em, `text-wrap: balance` |
| Titre de carte | 17, 600 |
| Ligne (tâche, article, rendez-vous) | 16, 500, `text-wrap: pretty` |
| Méta (échéance, heure) | 13, 400-600, chiffres tabulaires |
| Puces et compteurs | 12, 600, chiffres tabulaires |

## Couleurs

Jetons dans `src/app/globals.css` (clair et sombre), exposés dans `tailwind.config.ts` sous `tone-{todo,list,meal,agenda}` avec les variantes `DEFAULT` (formes), `soft` (fond), `ink` (texte sur fond doux, au moins 7:1).

- Fond clair légèrement chaud (`30 22% 97%`, proche de l'écran de lancement), cartes blanches.
- Fond sombre inchangé (gris foncé, pas de noir).
- Orange primaire inchangé, texte foncé dessus. Le rouge reste réservé au retard et aux suppressions.
- Cases non cochées : bord de 3:1 au moins sur la carte.

## Densité et surfaces

- Surface : coins 20 px, filet de 1 px et deux ombres douces (`shadow-surface`), plus de bordure dure.
- Ligne : 56 à 60 px de haut, séparateurs à 60 % d'opacité.
- Marges de page : 16 px sur téléphone, 32 px sur ordinateur, safe areas conservées.
- Anneau de progression (courses) plutôt qu'une barre de 4 px.

## Motion

CSS seul, aucune dépendance : `motion` n'est pas dans le projet et un composant React Bits aurait ajouté son poids pour un gain nul ici.

- Durées : 150 ms pour les états, 200 à 220 ms pour les entrées. Transforms et opacité uniquement (plus l'`stroke-dashoffset` de l'anneau).
- Entrée de ligne : fondu avec 6 px de montée, décalage de 30 ms pour les 6 premières.
- Toucher : `scale(0.9)` sur les cases, `0.985` sur les surfaces cliquables.
- `prefers-reduced-motion` : la règle globale de `globals.css` neutralise déjà animations et transitions.
- Pas de Lenis ni de GSAP dans l'app.

## Navigation

- Mobile : barre de 68 px + safe area, six emplacements (Accueil, Tâches, Agenda, Listes, Recettes, Plus) : Recettes sort de « Plus ». L'onglet actif est une pastille de 56 × 32 px à la teinte de son module.
- En-tête mobile : marque + nom, pastille de groupe, thème en cible de 44 px.
- Ordinateur : rubriques de 44 px, active à la teinte du module, marque dans l'en-tête.

## Composants partagés (`src/components/ui/`)

| Composant | Rôle |
|---|---|
| `tone.ts` | Classes par teinte (écrites en entier pour Tailwind) |
| `Surface` | Carte douce, option `interactive` |
| `PageHeader` | Titre, ligne de contexte, action |
| `CheckCircle` | Case ronde 48 px, Radix, par teinte |
| `QuickAdd` | Ajout rapide 52 px avec bouton « + » visible |
| `SegmentedList` / `SegmentedTrigger` | Onglets de 44 px avec compteur |
| `ProgressRing` | Anneau SVG |
| `ToneIcon` | Pastille d'icône de module |
| `EmptyState` | Pastille, phrase, action |
| `lib/dueLabel.ts` | « Aujourd'hui · 18:00 », « Demain », « Hier » |

## Suite proposée

Recettes (fiche et mode cuisine : texte plus grand, étapes à cocher), agenda, groupes, profil, puis `/kids` hors périmètre. Les anciens `Card`, `Tabs` et `Checkbox` restent pour les écrans non migrés.
