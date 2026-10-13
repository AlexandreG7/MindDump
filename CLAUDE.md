# MindDump — règles pour les agents

- **Un élément reste toujours attaché à son auteur** (recettes, tâches, listes,
  événements…) : aucune évolution ne doit le faire disparaître pour lui. Voir
  `docs/adr/0001-les-elements-restent-attaches-a-leur-auteur.md`.
- Exception : le semainier appartient au profil enfant (groupe), pas à son auteur.
  Voir `docs/adr/0002-semainier-profil-enfant-rubriques-familiales.md`.
- Tout changement touchant aux groupes, adhésions, profils du foyer ou filtres
  d'accès se vérifie côté utilisateur : `npm run build && npm run test:ownership`
  (test bloquant aussi dans le stage `test` du Dockerfile, donc au déploiement).
- Migrations : `docs/migrations-prisma.md`.
