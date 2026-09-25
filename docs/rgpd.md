# Conformité RGPD

- **Consentement** : case obligatoire à l'inscription, vérifiée côté serveur (400 sans
  `consent: true`). Preuve stockée : `User.consentedAt` et `User.consentVersion`
  (`CONSENT_VERSION` dans `src/lib/consent.ts`, à incrémenter à chaque changement substantiel de la
  politique).
- **Comptes Google et comptes antérieurs** : le middleware redirige vers `/consentement` tant que
  le jeton ne porte pas `consented`. Le callback `jwt` relit la base tant que ce n'est pas le cas.
  Les routes API ne sont pas bloquées : le blocage porte sur l'interface.
- **Politique** : `/confidentialite` (`src/app/confidentialite/page.tsx`), page publique mais en
  `noindex` et hors sitemap : l'adresse de contact y est affichée en clair.
  L'identité de l'éditeur vient de variables d'environnement (Coolify), pas du code, car le dépôt
  GitHub est public : `PRIVACY_CONTROLLER`, `PRIVACY_CONTACT_EMAIL`, `PRIVACY_MAIL_PROVIDER`
  (voir `src/lib/privacy.ts`). Tant qu'elles ne sont pas définies, la page affiche « [à compléter…] » :
  à renseigner **avant** la mise en production, puisque tout le monde doit accepter ce texte.
- **Cookies** : uniquement des cookies strictement nécessaires (session NextAuth) et des préférences
  d'interface en localStorage (`theme`, `sidebarCollapsed`, `currentGroupId`), plus
  `nextauth.message` posé par NextAuth pour synchroniser la session entre onglets. Pas de bandeau
  (exemption CNIL), mais une mention dans la politique. Les polices sont servies localement
  (`next/font`) : plus d'appel à Google Fonts.
- **Droits** : dans `/profile`, « Exporter mes données » (`GET /api/users/me/export`) et
  « Supprimer mon compte » (`DELETE /api/users/me/account`). La suppression :
  - transmet tout groupe qui a encore des membres (au plus ancien admin, sinon au plus ancien
    membre), **groupe par défaut compris** (il devient un groupe ordinaire chez son nouveau
    propriétaire) ; les groupes sans autre membre sont supprimés ;
  - laisse **la personne choisir** (`keepShared`, obligatoire, sans valeur par défaut) pour ce
    qu'elle a rangé dans ces groupes : le laisser aux autres membres (rattaché au propriétaire du
    groupe) ou le supprimer. Dans l'app, tout élément appartient à un groupe (le groupe par défaut
    si rien n'est précisé) ;
  - supprime toujours le semainier et les abonnements calendrier (URL ICS souvent porteuses d'un
    jeton privé : les transférer continuerait d'importer l'agenda de la personne partie) ;
  - ne touche jamais aux éléments des autres membres, puis efface du disque les photos des
    recettes supprimées.

Les colonnes `consentedAt` / `consentVersion` sont créées par migration : voir `docs/migrations-prisma.md`.
