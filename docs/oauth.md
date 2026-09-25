# Connexion Google et Apple

Chaque fournisseur n'est actif que si ses variables d'environnement sont définies
(`src/lib/authProviders.ts`). Les boutons « Continuer avec… » de `/login` et `/register`, et la
section « Connexion » du profil, n'affichent que les fournisseurs actifs.

## Règles

- **Nouveau compte via Google/Apple** : créé automatiquement, avec son groupe par défaut, puis
  bloqué sur `/consentement` jusqu'à l'acceptation de la politique (voir `docs/rgpd.md`).
- **Email déjà inscrit, personne déconnectée** : refus (`OAuthAccountNotLinked`), avec un message
  qui invite à se connecter par mot de passe puis à lier le fournisseur depuis le profil. Pas de
  liaison automatique par email : un fournisseur ne peut jamais prendre le contrôle d'un compte
  existant.
- **Liaison** : profil → section « Connexion » → « Lier ». Un compte Google/Apple déjà lié à un
  autre utilisateur MindDump est refusé (`/profile?link=taken`).
- **Déliaison** : autorisée tant qu'il reste un autre moyen de connexion (mot de passe ou autre
  fournisseur). À la déliaison et à la suppression du compte, les jetons Apple sont révoqués.
- Clés API : elles ne peuvent ni lister, ni lier, ni délier les moyens de connexion.

## Pourquoi un « cookie d'intention » pour lier

Apple revient sur le callback par un **POST cross-site** (`response_mode=form_post`). Le cookie de
session NextAuth (SameSite=Lax) n'y est pas envoyé, donc NextAuth ne sait pas qui est connecté et
créerait un nouveau compte. Plutôt que d'affaiblir le cookie de session :

1. « Lier » appelle `POST /api/users/me/accounts`, qui pose `minddump.link-intent` : un JWT
   chiffré `{userId, provider}`, valable 10 minutes, limité à `/api/auth`, SameSite=None en HTTPS ;
2. sur le callback de ce fournisseur, `src/app/api/auth/[...nextauth]/route.ts` utilise
   `linkAuthOptions()` (`src/lib/accountLinking.ts`), qui rattache le compte OAuth à `userId` ;
3. le cookie est effacé à la fin du callback, que la liaison ait réussi ou non, et à la déconnexion.

L'intention porte un nonce que le bouton « Lier » place dans l'URL de retour (`li=`). Elle n'est
honorée que si le cookie `callback-url` de NextAuth contient ce nonce, c'est-à-dire pour la
tentative lancée par ce bouton. Sans cela, une liaison abandonnée pourrait rattacher le compte
Google/Apple d'une autre personne qui se connecte ensuite sur le même navigateur.

Pour la même raison, en HTTPS, les cookies NextAuth `pkce`, `state`, `nonce` et `callback-url`
passent en SameSite=None (`oauthCookies()`). Le cookie de session et le jeton CSRF restent en Lax.
« En HTTPS » est déterminé par `src/lib/secureCookies.ts`, qui suit la même règle que NextAuth
(`NEXTAUTH_URL`, à défaut `NODE_ENV`) : les noms de cookies doivent rester identiques des deux
côtés, sinon la liaison échoue.

## Configurer Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs et services → Écran de
   consentement OAuth : type « Externe », nom MindDump, domaine `minddump.fr`, lien vers
   `https://minddump.fr/confidentialite`.
2. Identifiants → Créer → ID client OAuth → Application Web. URI de redirection autorisés :
   - `https://minddump.fr/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (tests en local)
3. Copier l'ID et le secret dans `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Coolify pour la prod,
   `.env` en local), puis redéployer.

## Configurer Apple

Prérequis : un compte Apple Developer (payant). Apple ne fonctionne qu'en HTTPS sur un domaine
déclaré : **pas de test possible en localhost**.

1. Certificates, IDs & Profiles → Identifiers → **App ID** avec la capacité « Sign in with Apple ».
2. Identifiers → **Services ID** (ex. `fr.minddump.web`) → activer Sign in with Apple → Configure :
   - Domains : `minddump.fr`
   - Return URLs : `https://minddump.fr/api/auth/callback/apple`
3. Keys → nouvelle clé avec « Sign in with Apple » → télécharger le `.p8` (une seule fois) et noter
   son Key ID.
4. Variables d'environnement :
   - `APPLE_ID` : le Services ID (`fr.minddump.web`)
   - `APPLE_TEAM_ID` : Team ID (en haut à droite du portail)
   - `APPLE_KEY_ID` : Key ID de la clé
   - `APPLE_PRIVATE_KEY` : contenu du `.p8`, sur une ligne, retours à la ligne remplacés par `\n`

Le « client secret » exigé par Apple (JWT ES256, 6 mois maximum) est généré par l'app à partir de la
clé et renouvelé tous les 30 jours : rien à régénérer à la main.

Particularités Apple : le nom n'est transmis qu'à la toute première autorisation, et l'email peut
être une adresse relais `@privaterelay.appleid.com`.

## Tester sans Google ni Apple

Un fournisseur OIDC de test (`test-oidc`) est activé par `OAUTH_TEST_ISSUER`, **uniquement hors
production** (`NODE_ENV !== "production"`, même si la variable est définie). Il imite Apple (retour
en `form_post`). Pointer `OAUTH_TEST_ISSUER` vers un serveur OIDC local (client `minddump-test` /
`minddump-test-secret`) et lancer `next dev`.
