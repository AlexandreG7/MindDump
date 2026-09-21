# Conformité RGPD

- **Consentement** : case obligatoire à l'inscription, vérifiée côté serveur (400 sans
  `consent: true`). Preuve stockée : `User.consentedAt` et `User.consentVersion`
  (`CONSENT_VERSION` dans `src/lib/consent.ts`, à incrémenter à chaque changement substantiel de la
  politique).
- **Comptes Google et comptes antérieurs** : le middleware redirige vers `/consentement` tant que
  le jeton ne porte pas `consented`. Le callback `jwt` relit la base tant que ce n'est pas le cas.
  Les routes API ne sont pas bloquées : le blocage porte sur l'interface.
- **Politique** : `/confidentialite` (`src/app/confidentialite/page.tsx`). Les passages `[à compléter]` sont à renseigner avant la mise
  en production.
- **Cookies** : uniquement des cookies strictement nécessaires (session NextAuth) et des préférences
  d'interface en localStorage (`theme`, `sidebarCollapsed`, `currentGroupId`). Pas de bandeau
  (exemption CNIL), mais une mention dans la politique. Les polices sont servies localement
  (`next/font`) : plus d'appel à Google Fonts.
- **Droits** : dans `/profile`, « Exporter mes données » (`GET /api/users/me/export`) et
  « Supprimer mon compte » (`DELETE /api/users/me/account`). La suppression transmet les groupes
  partagés qui ont encore des membres (au plus ancien admin, sinon au plus ancien membre), supprime
  les autres groupes ainsi que le groupe par défaut, puis efface les photos de recettes du disque.

Les colonnes `consentedAt` / `consentVersion` sont créées par migration : voir `docs/migrations-prisma.md`.
