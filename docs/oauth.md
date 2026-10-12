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

## Bêta privée : inscriptions sur invitation

MindDump est en bêta privée. **Fermé par défaut** : un compte ne peut être créé que si l'adresse est
dans `ALLOWED_SIGNUP_EMAILS` **ou** si une invitation valide la vise. Les deux voies passent par
`createUserWithGrant` (`src/lib/signupInvite.ts`), seul chemin de création d'un utilisateur.

### Parcours

1. `/register` (sans jeton) : « Demander un accès à la bêta » (e-mail, prénom, message de 500
   caractères au plus, consentement). `POST /api/beta-requests` répond **toujours** « Merci, on revient
   vers toi » : adresse déjà inscrite, déjà demandée, déjà invitée ou nouvelle (aucune énumération des
   comptes). Les doublons sont fusionnés (une demande par adresse normalisée). Seules la saisie
   invalide (400) et la limite de débit (429) se distinguent.
2. `/admin`, onglet « Demandes d'accès » (`src/app/admin/BetaRequestsPanel.tsx`) : liste (e-mail, prénom,
   message, date, statut : en attente, invitée, inscrite, refusée), « Accepter », « Régénérer le
   lien », « Refuser », et « Créer un lien pour un e-mail » (sans demande préalable). Routes
   `/api/admin/beta-requests`, `/api/admin/signup-invites` : `requireAdmin()` (401 / 403).
3. « Accepter » crée un **lien à usage unique**, lié à l'adresse, valable **14 jours**, affiché une
   seule fois avec « Copier ». Alexandre le transmet lui-même. Il n'y a pas d'envoi d'e-mail.
   En stock : seule l'empreinte SHA-256 du jeton (32 octets aléatoires, base64url), comme
   `passwordReset.ts`. Générer un nouveau lien pour la même adresse, ou refuser, **invalide** les
   précédents.
4. `/register?invite=<jeton>` : jeton valide = formulaire d'inscription, e-mail pré-rempli et
   verrouillé ; invalide, expiré, utilisé ou remplacé = message clair et lien vers la demande d'accès.
5. Le jeton est **consommé dans la transaction de création du compte** (`updateMany` conditionnel sur
   jeton + adresse + non utilisé + non révoqué + non expiré, et verrou `pg_advisory_xact_lock` sur
   l'adresse) : deux inscriptions simultanées, un seul compte.

### Google / Apple avec un lien

Avant de lancer le fournisseur, `POST /api/signup-invite` valide le jeton et le pose dans un cookie
**httpOnly** de 15 minutes (`minddump.signup-invite`, limité à `/api/auth`, `SameSite=None; Secure` en
HTTPS comme `oauthCookies` pour survivre au `form_post` d'Apple). Sur le callback, la route
`[...nextauth]` construit les options avec `authOptionsWithInvite(jeton)` et efface le cookie. Le
callback `signIn` autorise une **création** seulement si :

- l'e-mail du fournisseur est **vérifié** (`email_verified === true` ou `"true"`, sinon refus) ;
- ET il est dans `ALLOWED_SIGNUP_EMAILS`, OU il correspond (normalisé) à l'invitation du cookie.

E-mail du fournisseur différent de l'invitation : `/login?error=InviteEmailMismatch`, « Utilise
l'adresse à laquelle tu as été invité ». Sans cookie : `/login?error=SignupClosed`. Un compte
existant (même adresse sans tenir compte de la casse) n'est jamais concerné : connexion habituelle
ou refus « compte existant ». Le filet `createUser` de l'adaptateur refuse tout ce que le callback
n'a pas autorisé et consomme l'invitation.

### Invitation de foyer : le lien de groupe ouvre aussi l'inscription

Un lien `/groups/join/<jeton>` (`GroupInvite`, valable 7 jours, créé par un admin ou le propriétaire
du groupe) donne le droit de créer UN compte, puis ramène au groupe (`src/lib/groupInviteSignup.ts`).

- Modèle existant : le lien est **ouvert** (`email` vide) ou **nominatif** (`email`), et sert **une
  fois** à rejoindre (`usedAt`, posé par `POST /api/groups/join/[token]`, flux inchangé : rôle
  « member »). Les nouveaux jetons font 32 caractères aléatoires (`randomBytes(24)`), les anciens
  (cuid) restent acceptés.
- Règle d'inscription (la plus prudente pour un lien qui peut fuiter) : lien non expiré, pas encore
  utilisé pour rejoindre, **une seule inscription par lien** (`GroupInvite.signupClaimedAt`, posé par
  un `updateMany` conditionnel dans la transaction de `createUserWithGrant`, sous le même verrou
  consultatif par adresse) ; nominatif = seule son adresse (sans tenir compte de la casse). Un lien
  de foyer ouvert qui fuite ne crée donc qu'un compte, pas un accès à la bêta pour tout le monde.
  Limites de débit : `/api/auth/register` (10 essais / 15 min / IP), `/api/signup-invite` (30), et
  `GET /api/groups/join/[token]` (60).
- Parcours : lien sans session → la page du groupe propose « Se connecter » (`/login?callbackUrl=`)
  et, si le lien le permet, « Créer mon compte » (`/register?groupInvite=<jeton>`). Après
  l'inscription (mot de passe : connexion automatique ; Google/Apple : `callbackUrl` du fournisseur),
  retour sur `/groups/join/<jeton>` et adhésion par le bouton habituel.
- Google/Apple : même mécanique que le lien bêta, avec son propre cookie httpOnly de 15 minutes
  (`minddump.signup-group-invite`, posé par `POST /api/signup-invite` avec `{ groupInvite }`, lu
  uniquement sur le callback). Comme pour le lien bêta, dans l'app native : mot de passe seulement.
- `callbackUrl` : chemin interne uniquement (`src/lib/safeCallback.ts` : refuse `//`, `\`, tabulation
  ou retour à la ligne, et toute URL qui change d'origine).
- ADR 0001 : l'inscription ne touche à aucun élément existant ; l'adhésion suit le flux existant
  (mêmes règles de rôle et de visibilité). Test : `tests/group-invite.test.mjs` (dans `test:signup`)
  et la section 10 de `tests/ownership.test.mjs`.

### Circuit mobile

`/api/mobile-auth/*` ne crée aucun utilisateur : il passe par NextAuth, dans le **navigateur
système**, dont les cookies ne sont pas ceux de la WebView de l'app. Le cookie d'invitation posé
depuis la WebView n'y serait pas, et faire transiter le jeton par l'URL de `start` l'exposerait
davantage. Choix : **pas d'inscription Google/Apple depuis l'app avec un lien**. Dans l'app, sur
`/register?invite=`, les boutons Google/Apple sont remplacés par une explication ; l'inscription par
mot de passe fonctionne dans l'app. Parcours conseillé pour Google/Apple : ouvrir le lien dans le
navigateur du téléphone, créer le compte, puis se connecter dans l'app (connexion d'un compte
existant : inchangée).

### `ALLOWED_SIGNUP_EMAILS` (contournement manuel, facultatif)

Variable d'**exécution** (Coolify) pour l'administrateur et les proches : adresses séparées par une
virgule, un point-virgule, un espace ou un retour à la ligne ; guillemets en bordure retirés ; casse
ignorée. Une entrée qui n'est pas une adresse ASCII valide est **ignorée**, avec un seul
avertissement dans les journaux (le nombre d'entrées, jamais les adresses). Logique :
`src/lib/signupAllowlist.ts`, e-mails : `src/lib/email.ts`.

**Risque restant** : sans jeton, l'inscription par **mot de passe** d'une adresse de la liste ne
prouve pas que l'on possède cette boîte mail (`emailVerified` est posé sans envoi de message). Qui
connaît une adresse de la liste peut créer le compte avant son titulaire. Atténuation : liste
courte et secrète, limite de débit sur `/api/auth/register`. Pour tout autre invité, c'est le lien qui
prouve que la personne a été choisie. Google/Apple exigent, eux, un e-mail vérifié.

### Adresses e-mail

Une seule normalisation (`trim`, NFKC, minuscules), adresses ASCII strictes seulement (le signe
Kelvin « K », que NFKC replierait sur « K », est refusé). Les **nouveaux** comptes sont stockés en
minuscules. Les comptes existants à casse mixte ne sont pas réécrits : `authorize` cherche l'adresse
exacte, puis sans tenir compte de la casse si le résultat est unique (deux comptes qui ne diffèrent
que par la casse et aucune correspondance exacte : refus, on ne devine pas). L'inscription, le
callback `signIn`, `getUserByEmail` de l'adaptateur et le mot de passe oublié font la même recherche.

### Limite de débit

`src/lib/rateLimit.ts`, **en mémoire** : 10 essais / 15 min / IP sur `/api/auth/register`, 5 demandes /
heure / IP **et 60 / heure toutes IP confondues** sur `/api/beta-requests` (plafond de 1 000 demandes en
attente : au-delà, réponse « ok » sans stockage, avertissement dans les journaux sans l'adresse,
corps refusé au-delà de 8 Ko : 413), 30 essais / 15 min / IP sur `/api/signup-invite` (JSON exigé,
415 sinon). **Connexion par mot de passe** (`authorize`) : 10 ÉCHECS / 15 min par IP et 10 par e-mail
normalisé, message « Trop de tentatives » identique que le compte existe ou non ; un succès remet
le compteur de l'adresse à zéro, donc un compte existant se connecte toujours. Limite assumée :
saturer volontairement le compteur d'une adresse gêne son titulaire jusqu'à 15 minutes. Les IPv6 sont
regroupées par préfixe /64 ; table pleine (10 000 clés), les plus anciennes entrées sont évincées
(jamais de remise à zéro générale). Les POST sensibles (`/api/beta-requests`, `/api/signup-invite`,
`/api/admin/*` de la bêta) refusent en 403 un en-tête `Origin` présent et différent du site
(`assertSameOrigin`, `src/lib/sameOrigin.ts`, origine de `NEXTAUTH_URL`). `/register?invite=` est servi
en `Cache-Control: no-store` et `/register` est exclu du cache du service worker. Une seule
instance (Coolify) : exact, mais remis à zéro à chaque déploiement, non partagé entre instances, et
sans effet contre un attaquant qui change d'IP. L'IP est la **dernière** entrée de `X-Forwarded-For`
(celle que le proxy ajoute ; les précédentes sont inventées par le client). Si plusieurs proxys sont
chaînés devant l'app, tous les visiteurs partageraient un seau : à revoir.

Correction d'une affirmation erronée de la version précédente (« pas d'énumération ») : contrôler la
liste avant de lire la base ne protège que les adresses **hors** liste ; pour une adresse de la liste
ou invitée, le 409 « Un compte existe déjà » révèle qu'elle est inscrite, et la liste elle-même
peut être sondée par essais. C'est la limite de débit qui freine l'essai en masse.

Hors périmètre, volontairement : la connexion d'un compte existant (mot de passe, OAuth déjà lié),
la liaison d'un fournisseur depuis le profil ou l'app (`linkAuthOptions` ne crée personne), les
adhésion à un groupe (compte connecté ; l'inscription par lien de foyer est décrite plus haut) et les profils du foyer (sans compte).
Test : `npm run test:signup` (enchaîne `tests/signup.test.mjs`, `tests/beta.test.mjs` et `tests/group-invite.test.mjs`, bloquant au
déploiement).

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
