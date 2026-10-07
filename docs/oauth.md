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
`minddump-test-secret`) et lancer `next dev`. Le script `node scripts/test-oidc-server.mjs`
(sans dépendance, port 4010, `OAUTH_TEST_ISSUER=http://localhost:4010`) en fournit un : page avec un
compte par bouton plus « Annuler », ou `?auto` / `OIDC_AUTO=1` pour accepter sans clic, compte courant
changé par `/__subject?sub=…&email=…`. Garder `localhost` des deux côtés (même site : les cookies Lax
suivent le POST du retour).

## Connexion depuis l'app mobile

Google refuse l'OAuth dans une WebView embarquée (`disallowed_useragent`) et Apple le déconseille.
L'app (Capacitor, `docs/app-mobile.md` phase 3) passe donc par le navigateur système, sur le
modèle PKCE (`src/lib/mobileAuth.ts`) :

1. L'app tire un `verifier` aléatoire et ouvre, dans `ASWebAuthenticationSession` (iOS) ou Custom
   Tabs (Android), `/api/mobile-auth/start?provider=google|apple&challenge=<SHA-256 du verifier,
   base64url>`. Le défi est gardé en cookie (15 min, `SameSite=None` en HTTPS pour le retour Apple).
2. `/auth/mobile` lance `signIn(provider)` ; NextAuth revient sur `/api/mobile-auth/complete`
   (redirection vers `/login` sans session, vers `/consentement` sans consentement).
3. `complete` émet un code à usage unique (60 s, seul son SHA-256 est stocké dans
   `MobileAuthCode`) et redirige vers `minddump://auth?code=…`.
4. L'app, dans sa WebView, appelle `POST /api/mobile-auth/exchange {code, verifier}` : le cookie de
   session NextAuth y est posé (même jeton que NextAuth, 30 jours).

Toute tentative d'échange brûle le code, même avec un mauvais `verifier` : une autre app qui
intercepterait le lien `minddump://` n'aurait qu'un essai, sans le `verifier`. L'identifiant /
mot de passe fonctionne directement dans la WebView, sans ce détour. L'historique de connexion
(`LoginEvent`) est alimenté par la connexion du navigateur système, avec le fournisseur réel.

### Lier ou délier un compte depuis l'app (mode « liaison »)

Depuis le profil de l'app, « Lier » suit le même circuit que la connexion, mais ne connecte
personne : le compte OAuth est rattaché à **l'utilisateur connecté dans la WebView**, et aucune
session ni aucun utilisateur n'est créé. Code : `src/lib/mobileLink.ts`, `src/lib/accountLinking.ts`.

```
WebView (session)   POST /api/mobile-auth/link-ticket {provider, challenge}      réservé à l'app, session
                    <- ticket (aléatoire, 5 min, usage unique ; SHA-256 stocké avec userId, provider, défi)
Navigateur système  GET /api/mobile-auth/start?mode=link&ticket=…                 NE consomme PAS le ticket :
                    page de confirmation « Lier ton compte Google au compte MindDump de <nom>
                    (<e-mail complet>) ? Si quelqu'un t'a envoyé ce lien, refuse. » + cookie SameSite=Strict (jeton lié au ticket, 10 min)
                    POST /api/mobile-auth/start (« Continuer »)                           consomme le ticket
                    exige : cookie Strict = jeton du formulaire, Origin = site
                    pose : intention de liaison {userId DU TICKET, provider, nonce, ticketId}
                           (cookie chiffré, /api/auth, 10 min) + cookie {mode:link, ticketId}
                    -> /auth/mobile?li=nonce -> signIn(provider, callbackUrl=complete?li=nonce)
Fournisseur         retour sur /api/auth/callback/<provider> (form_post pour Apple)
NextAuth (callback) options `linkAuthOptions` : jwt.decode neutralisé (une session présente dans le
                    navigateur système n'est jamais lue), createUser renvoie l'utilisateur du
                    ticket, compte déjà lié à un autre -> /api/mobile-auth/complete?link=taken
                    (rien en attente), pas de LoginEvent, cookies de session retirés de la réponse.
                    linkAccount N'ÉCRIT PAS l'Account : l'identité (providerAccountId, e-mail du
                    fournisseur, jetons dont le refresh_token Apple) est mise EN ATTENTE sur le
                    ticket (colonnes pending*, jetons chiffrés AES-256-GCM, src/lib/secretBox.ts)
/api/mobile-auth/complete  lit le ticket (cookie), calcule le résultat (identité en attente ? linked ;
                    sinon Account déjà à userId ? linked ; sinon error ; taken/error seulement s'ils
                    ont été signalés, et purgent l'attente), dépose codeHash (SHA-256, 60 s)
                    -> minddump://auth?code=…&mode=link
WebView (session)   POST /api/mobile-auth/link-exchange {code, verifier}
                    exige la session de l'utilisateur du ticket, PKCE, code à usage unique (brûlé et
                    attente purgée dès la tentative) ; PUIS SEULEMENT crée l'Account dans une
                    transaction (contrainte unique revérifiée : conflit -> taken)
                    -> {result: linked|taken|error, provider} ; aucun cookie posé
```

Modèle de menace :

- **Fixation de ticket (CSRF de connexion)** : le ticket est un porteur dans l'URL. Un attaquant
  crée un ticket depuis SON app et envoie `…/start?mode=link&ticket=<le sien>` à une victime ; si elle
  s'authentifiait chez Google, son Google serait rattaché au compte de l'attaquant, qui y retrouverait
  ensuite ses données. Parades : (0) **la liaison est différée** (voir « Liaison différée » ci-dessous) :
  même si la victime va jusqu'au bout de l'OAuth, rien n'est lié tant que la session du titulaire du
  ticket n'a pas échangé le code ; (1) le GET ne pose aucune intention et ne lance pas l'OAuth, il affiche
  à qui appartient le ticket (nom et e-mail COMPLET : le détenteur du ticket les connaît déjà, et un
  e-mail masqué ne suffisait pas contre un lien ciblé, l'attaquant choisissant son nom et une adresse
  qui commence par la même lettre) avec « Si quelqu'un t'a envoyé ce lien, refuse. » ;
  la victime voit un autre nom et refuse (« Ce n'est pas mon compte » brûle le ticket) ; (2) seul le POST de
  la page consomme le ticket. Un formulaire auto-soumis par un site tiers saute la confirmation sans les
  parades suivantes : le GET pose un cookie `SameSite=Strict` httpOnly (10 min) contenant l'empreinte du
  ticket et un jeton aléatoire, que la page remet en champ caché ; le POST exige que les deux
  correspondent (comparaison à temps constant) et que l'en-tête `Origin` soit celui du site
  (`NEXTAUTH_URL`) ; un POST cross-site n'envoie pas le cookie Strict. Reste hors de portée : une victime
  qui confirme malgré un nom qui n'est pas le sien (ingénierie sociale).
- **Liaison différée (fixation ciblée)** : le callback OAuth n'écrit jamais l'`Account`. Il met
  l'identité obtenue en attente sur le ticket ; le code (déposé par `complete`) part vers `minddump://`,
  donc vers l'app de la personne qui a fait l'OAuth dans ce navigateur. `link-exchange` n'aboutit que
  pour la session de `ticket.userId`, avec le verifier PKCE, et c'est là seulement que l'`Account` naît.
  Scénario « ticket de l'attaquant, OAuth de la victime » : l'attaquant ne reçoit jamais le code (échange
  refusé) ; l'app de la victime le reçoit mais sa session n'est pas celle du ticket (refusé, code brûlé,
  attente purgée) : aucun `Account` dans les deux cas. Un parcours abandonné après l'OAuth ne lie
  rien. Jetons en attente : chiffrés au repos (AES-256-GCM, clé dérivée de `NEXTAUTH_SECRET` et du
  contexte), jamais journalisés, purgés à l'échange (réussi ou non), à l'échec/« taken » signalé, à
  l'expiration du parcours (15 min sans code) ou du code (60 s), lors de la prochaine émission ou
  consommation d'un ticket ; les lignes disparaissent après 1 h et avec le compte. Reste hors de portée :
  une victime dont l'app est connectée au compte de l'attaquant (elle y reçoit le code sous cette session).
- **Qui est lié** : uniquement le `userId` du ticket, fixé par la session de la WebView au moment de
  la demande. L'URL d'`start` ne porte que le ticket (`userId`, `provider`, `challenge` en paramètres
  sont ignorés). Un ticket d'un utilisateur A ne lie jamais B, même si la WebView de B présente le code.
- **Interception** : le ticket (dans l'URL du navigateur système) est à usage unique, 5 minutes, et
  ne donne qu'une page OAuth. Le code de retour (`minddump://`) ne vaut rien sans le verifier PKCE
  gardé dans la WebView et sans la session de l'utilisateur du ticket ; toute tentative le brûle.
- **Rejeu / expiration** : ticket (5 min) et code (60 s) à usage unique, marqués par `updateMany`
  conditionnel (pas de course).
- **Session parasite dans le navigateur système** : NextAuth lie « à la personne connectée » avant de
  regarder l'intention ; le mode app rend la session illisible (`jwt.decode` nul) et retire tout cookie
  de session de la réponse. Testé avec une session d'un autre utilisateur dans le navigateur.
- **Compte déjà pris** : refus (`taken`), aucune modification, aucune liaison par e-mail
  (`getUserByEmail` nul). `exchange` revérifie en base avant d'annoncer `linked`.
- **Intention non appariée / abandonnée** (nonce absent du cookie `callback-url`) : la route NextAuth
  l'ignore, efface le cookie et laisse la connexion se dérouler normalement. `start` en mode connexion
  efface aussi toute intention restée dans le navigateur (liaison annulée). Jamais de compte créé.
  Le cookie de parcours `minddump.mobile-auth` (SameSite=None, 15 min) porte le nonce de la tentative : une
  erreur de connexion WEB faite ensuite dans ce navigateur ne revient à l'app que si l'URL de retour
  mémorisée par NextAuth porte ce nonce ; sinon le cookie est effacé et l'erreur retourne vers `/login`.
  `complete` l'efface aussi quand le parcours est invalide ; `start` en mode connexion le réécrit.
- **Refus chez le fournisseur** (`access_denied`) : NextAuth redirige vers `/api/auth/signin?error=…`
  ou `/api/auth/error?error=…` (nouvelle requête, intention déjà consommée) puis `/login`. La route
  NextAuth intercepte ces deux GET quand le cookie de parcours est en mode `link` et renvoie vers
  `complete?link=error` : le navigateur revient à l'app (« La liaison avec … a échoué. Réessaie. »).
  (`pages.error` ne suffit pas : NextAuth range ces erreurs sur la page de connexion.) Un `error` en
  paramètre n'est jamais pris pour un succès. `complete` sans parcours en cours redirige vers
  `/login?error=LinkExpired`, jamais de JSON brut.
- **Limite de débit** : 5 tickets actifs (non consommés, non expirés) par utilisateur, sinon 429.
- **Délier** : inchangé (`DELETE /api/users/me/accounts`, session obligatoire, refus s'il ne reste
  aucun autre moyen de connexion, révocation Apple conservée). Le comptage et la suppression se font
  dans une transaction qui verrouille la ligne `User` (`FOR UPDATE`) : deux déliaisons simultanées ne
  peuvent pas retirer toutes les deux le dernier moyen. Une clé API ne peut pas demander de ticket.
- **Page de confirmation** : `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
  base-uri 'none'; frame-ancestors 'none'` (sans `form-action` : Chrome l'appliquerait à la redirection 303
  vers `minddump://`), `Referrer-Policy: same-origin` (pas `no-referrer` : le navigateur enverrait `Origin: null` sur le POST
  du formulaire, que la route refuse ; constaté sur le simulateur iOS), `X-Frame-Options: DENY`.
- **Limites** : `provider` du ticket vérifié contre les fournisseurs actifs ; ticket, code, jetons et
  e-mails ne sont jamais journalisés (un POST refusé pour mauvaise `Origin` journalise l'Origin reçue et
  l'attendue, pour repérer un `NEXTAUTH_URL` erroné en production) ; lignes purgées après 1 h (`MobileLinkTicket`, supprimées avec le compte).
