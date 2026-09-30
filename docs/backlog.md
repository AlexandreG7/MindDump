# Backlog : idées notées, pas encore planifiées

Fonctionnalités mises de côté à la demande d'Alexandre (30/09/2026). Ne pas les
implémenter sans son accord. Le contexte vient de l'étude de marché des agendas
familiaux et du plan de features (phases 0 à 8).

## Garde alternée

Pour les foyers séparés, savoir chaque jour chez quel parent est chaque enfant.

- Un motif qui se répète sur plusieurs semaines : semaine A/B, 2-2-3, un
  week-end sur deux, ou personnalisé. Il s'applique à un profil enfant
  (`FamilyProfile`, kind `child`) avec une date de départ.
- Exceptions ponctuelles (vacances scolaires, échange d'un jour).
- Affichage en bandeau dans les vues semaine et jour du calendrier et sur
  l'écran mural (« Léa chez papa »).
- Demande d'échange de jours entre parents : proposition, acceptation,
  notification.
- Points ouverts : les deux parents ne sont pas toujours dans le même groupe
  MindDump ; il faudra peut-être partager un profil enfant entre deux groupes.

## Commentaires sur les événements

- Modèle `EventComment` (événement, auteur, texte, date), visible par les
  personnes qui voient l'événement.
- Notification (push, sinon email) des personnes assignées à l'événement et de
  son auteur, avec la règle des rappels ciblés (`src/lib/notify.ts`).
- Fil de commentaires dans `EventDialog`, compteur sur l'événement.
- Suppression par l'auteur du commentaire ou un admin du groupe. À ajouter à
  l'export et à la suppression de compte (`src/lib/account.ts`) et à la
  politique de confidentialité.

## Repas affichés dans la vue calendrier

Les repas prévus (`MealPlanEntry`) existent dans l'onglet Recettes › Semaine et
sur l'écran mural, mais pas dans le calendrier.

- Une ligne « Repas » (midi / soir) en haut des vues semaine et jour, une
  mention discrète dans la vue mois.
- Tap sur un repas : ouvrir la recette ; tap sur un créneau vide : choisir une
  recette (réutiliser le sélecteur de `MealPlanner`).
- Respecter les flags `recipes`, `recipesWeek` et `recipesPlanned` : pas de
  ligne repas si la vue Semaine des recettes est désactivée.
- Glisser-déposer d'un repas d'un jour à l'autre.
