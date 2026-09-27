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
- **Personnes du foyer** (`FamilyProfile`) : un enfant (ou un adulte sans compte) est un profil
  du groupe, **pas un compte** : il ne peut pas se connecter, seuls les membres du groupe gèrent son
  profil et son semainier. Données : prénom, couleur, emoji, date de naissance facultative. Le
  profil disparaît avec le groupe ou quand un membre le retire (avec son semainier).
- **Écrans muraux** (`WallDevice`) : lien secret `/wall/<jeton>` créé par un admin du groupe ; seule
  l'empreinte SHA-256 du jeton est stockée. L'écran ne montre que les éléments du groupe (jamais les
  éléments personnels des membres) et ne permet que de cocher tâches et courses. Supprimer l'écran
  révoque le lien. Le navigateur de l'écran garde le dernier tableau en localStorage (`wall:snapshot`)
  pour rester lisible hors ligne ; il est effacé quand le lien est révoqué.
- **Disposition de l'accueil** (`User.dashboardLayout`, `src/lib/dashboardLayout.ts`) : modules affichés,
  ordre et largeur. Simple préférence d'interface, incluse dans l'export, supprimée avec le compte.
- **Mot de passe oublié** (`src/lib/passwordReset.ts`) : table `VerificationToken` de NextAuth,
  `identifier` = adresse du compte, `token` = empreinte SHA-256 du jeton envoyé par e-mail (jamais le
  jeton lui-même). Valable une heure, à usage unique, un seul lien actif, un envoi au plus toutes les
  2 minutes. La route répond pareil que le compte existe ou non. Le changement déconnecte l'app mobile
  (`MobileDevice` supprimés) ; les sessions web en JWT restent valides jusqu'à expiration. Supprimé
  avec le compte (même `identifier`).
- **Panier drive** (`DriveProduct`) : produit Match retenu pour chaque article (SKU, libellé,
  marque, format, dernier prix, compteur d'utilisation), rattaché au **groupe** et supprimé avec
  lui ; il reste au groupe quand un membre supprime son compte. Présent dans l'export, sous chaque
  groupe. MindDump n'envoie rien à Match et ne reçoit ni identifiants, ni panier, ni commande :
  l'extension travaille dans le navigateur de la personne (voir `docs/drive-match.md`).
- **Cookies** : uniquement des cookies strictement nécessaires (session NextAuth) et des préférences
  d'interface en localStorage (`theme`, `sidebarCollapsed`, `currentGroupId`, `kids:selectedProfile`), plus
  `nextauth.message` posé par NextAuth pour synchroniser la session entre onglets. Pas de bandeau
  (exemption CNIL), mais une mention dans la politique. Les polices sont servies localement
  (`next/font`) : plus d'appel à Google Fonts.
- **Hors ligne et notifications (PWA, `docs/app-mobile.md`)** : le service worker garde sur
  l'appareil les pages vues, la session et les listes de courses ; la file
  `minddump-offline-list-ops` (localStorage) garde les modifications faites sans réseau.
  Abonnements Web Push dans `PushSubscription` (endpoint, clés, navigateur, dernier envoi) ;
  préférence e-mail dans `User.notifyEmail`. La déconnexion (`signOutAndClear`,
  `src/lib/signOut.ts`) désabonne l'appareil et efface caches et file ; la suppression du compte
  efface les abonnements en cascade. L'export contient les appareils abonnés, sans endpoint ni
  clés (des secrets d'envoi). Les services push des navigateurs ne voient que du contenu
  chiffré (RFC 8291). Mentionné dans `/confidentialite` (version `2026-09-v2`).
- **Droits** : dans `/profile`, « Exporter mes données » (`GET /api/users/me/export`) et
  « Supprimer mon compte » (`DELETE /api/users/me/account`). La suppression :
  - transmet tout groupe qui a encore des membres (au plus ancien admin, sinon au plus ancien
    membre), **groupe par défaut compris** (il devient un groupe ordinaire chez son nouveau
    propriétaire) ; les groupes sans autre membre sont supprimés ;
  - laisse **la personne choisir** (`keepShared`, obligatoire, sans valeur par défaut) pour ce
    qu'elle a rangé dans ces groupes : le laisser aux autres membres (rattaché au propriétaire du
    groupe) ou le supprimer. Dans l'app, tout élément appartient à un groupe (le groupe par défaut
    si rien n'est précisé) ;
  - applique ce même choix au semainier qu'elle a rempli pour un enfant du groupe (le semainier
    appartient au profil de l'enfant, pas au parent) ;
  - supprime toujours les abonnements calendrier (URL ICS souvent porteuses d'un jeton privé : les
    transférer continuerait d'importer l'agenda de la personne partie) ;
  - ne touche jamais aux éléments des autres membres, puis efface du disque les photos des
    recettes supprimées.

Les colonnes `consentedAt` / `consentVersion` sont créées par migration : voir `docs/migrations-prisma.md`.
