# MindDump — Axe rendez-vous & administratif

Suite de l'étude marketing. Complète [`01-marketing.md`](./01-marketing.md), qui traite l'axe repas → courses, et prépare les sections de page décrites dans [`02-ux-ui.md`](./02-ux-ui.md).

Même règle que le document fondateur : **rien ici ne promet ce que le code ne fait pas.** L'audit de l'existant (§3) et la liste des manques (§4) sont volontairement placés avant le positionnement, pour que les messages proposés ensuite restent tenables.

> **État d'avancement — 21/09/2026.** Vagues 1 et 2 livrées ; les §3, §4 et §10 décrivent l'état *avant* ces travaux.
> - Manque n°1 levé : outils MCP `create_event`, `list_events`, `update_event`, `delete_event` (+ `recurrence` sur `create_todo` / `update_todo`).
> - Manque n°2 levé : le rappel d'un élément rattaché à un groupe part à **tous ses membres** (`api/cron/notify`). Les événements récurrents rappellent désormais **chaque occurrence** (`CalendarEvent.notifiedOccurrence`).
> - Manque n°3 levé : récurrence `yearly` (tâches, événements, flux `.ics`).
> - Landing : section « L'autre charge mentale » (`DeadlinesSection`) entre les modules et le foyer. Guides `rendez-vous-famille` et `echeances-administratives-famille` publiés.
> - Restent ouverts : n°4 (rappel unique, saisi en minutes), n°5 (assignation), n°6 (pièces jointes), n°7 (catégories). La vague 3 n'est pas entamée, comme prévu.

---

## 1. Le point aveugle de l'étude actuelle

L'analyse fondatrice classe « Tâches + calendrier » en 5ᵉ position de la hiérarchie des messages, sous l'étiquette « la complétude ». C'est une erreur de hiérarchie, pour une raison simple : **la charge mentale du foyer a deux moitiés, et elles n'ont pas le même moteur d'achat.**

| | Cycle court | Cycle long |
|---|---|---|
| **Objets** | Repas, courses, linge, rangement | Rendez-vous, échéances, dossiers, démarches |
| **Rythme** | Quotidien, répétitif | Rare, daté, souvent annuel |
| **Coût de l'oubli** | Une pizza, une course en plus | Une pénalité, un droit perdu, un soin retardé |
| **Réversible ?** | Oui, toujours | Non, presque jamais |
| **Ce que ça vend** | Du confort, du temps gagné | De l'assurance contre l'oubli |

Le cycle court fait **installer** l'application : il est fréquent, visuel, facile à démontrer au scroll. Le cycle long fait **rester** : c'est le jour où l'app évite un oubli coûteux que l'utilisateur cesse de la considérer comme optionnelle.

Trois données cadrent l'enjeu :

- Les femmes consacrent en moyenne **3 h 26 par jour** aux tâches domestiques et parentales, contre 2 h pour les hommes (INSEE, enquête *Emploi du temps*).
- **77 % des femmes** déclarent avoir « trop de choses auxquelles penser » et **peur d'en oublier** (Ipsos). Le sentiment dominant n'est pas la fatigue, c'est **la peur de l'oubli** — un ressort d'évitement de perte, plus puissant qu'une promesse de gain.
- **6 à 10 % des rendez-vous médicaux ne sont pas honorés** (Conseil national de l'Ordre des médecins, Académie de médecine). L'oubli de rendez-vous n'est pas une anecdote de foyer désorganisé, c'est un phénomène de masse.

**Conclusion marketing :** l'axe repas est la meilleure *entrée en matière*. L'axe rendez-vous/administratif est le meilleur *argument de rétention*. La page actuelle ne défend que le premier.

> ⚠️ Symptôme à corriger en priorité. Le décor du hero décrit dans `02-ux-ui.md` fait flotter des notes « rdv pédiatre » et « relancer le plombier ». **La page ouvre donc la promesse administrative dès le premier écran — et ne la referme jamais.** Un visiteur venu pour ça ne trouve, plus bas, que des recettes.

---

## 2. Taxonomie de la charge administrative

Quatre familles d'objets, qui n'ont ni le même rythme ni les mêmes exigences outillées. Les confondre est l'erreur classique des apps familiales — qui rangent tout dans l'agenda.

| Famille | Exemples réels | Rythme | Ce qui fait échouer | Ce que ça exige d'un outil |
|---|---|---|---|---|
| **Le rendez-vous** | Pédiatre, dentiste, orthophoniste, réunion parents-profs, garagiste | Ponctuel, daté à l'heure | L'info dort dans le SMS de confirmation, sur **un seul** téléphone | Partage, **qui y va**, rappel à la bonne personne |
| **L'échéance récurrente** | Assurance habitation, contrôle technique (2 ans), rappel tétanos (20 ans), grippe (annuelle après 65 ans), déclaration d'impôts, renouvellement CNI/passeport, inscriptions scolaires et périscolaires | Annuel à pluriannuel | Rien ne la rappelle entre deux occurrences — la mémoire du foyer ne porte pas sur 12 mois | **Récurrence annuelle**, rappel long (J-60, J-30), relance |
| **Le dossier** | Pièces à réunir : justificatif de domicile, avis d'imposition, certificat médical, carnet de santé, RIB, livret de famille | Saisonnier (mars-juin, septembre) | Les pièces sont éparpillées entre deux boîtes mail et un tiroir | Checklist + **pièces jointes** |
| **La démarche** | CAF, MDPH, mutuelle, remboursement, litige, résiliation | Suivi par relances | Personne ne sait où ça en est, ni qui a relancé en dernier | Statut, relance datée, trace partagée |

**L'enseignement structurant :** trois familles sur quatre ne sont pas des événements de calendrier. Ce sont **des tâches à date lointaine, avec une pièce attachée et un responsable**. Un agenda seul ne les tient pas — et c'est précisément pour ça que les foyers utilisent encore une pochette en carton.

---

## 3. Ce que l'app fait réellement sur cet axe

Audit de `prisma/schema.prisma`, `src/app/api/` et `minddump-mcp/`.

| Capacité | État réel | Où |
|---|---|---|
| Rendez-vous daté, heure de fin, journée entière | ✅ | `CalendarEvent` |
| Récurrence quotidienne / hebdo / bimensuelle / mensuelle | ✅ | `src/lib/recurrence.ts` |
| Couleur par événement | ✅ | `CalendarEvent.color` |
| Rappel e-mail avant l'échéance | ✅ | `api/cron/notify` |
| Partage de l'agenda avec le foyer | ✅ | `Group.shareCalendar` |
| **Abonnement à un calendrier externe (iCal), partagé au groupe** | ✅ | `CalendarSubscription` |
| **Export du calendrier du foyer en flux `.ics`** | ✅ | `api/calendar/feed/[token]` — inclut les événements perso **et** ceux du groupe |
| Tâche avec échéance, priorité URGENT/PLANNED, rappel | ✅ | `Todo` |
| Invitation d'un membre par simple lien | ✅ | `GroupInvite` |
| Activation/désactivation du module calendrier | ✅ | `UserFeatureFlag` |

**Les trois preuves montrables dès aujourd'hui, sans écrire une ligne de code :**

1. **Le rendez-vous qui arrive tout seul.** L'abonnement iCal aspire un calendrier externe — celui de l'école, du club, ou l'agenda Google où atterrissent déjà les confirmations de rendez-vous — et le rend visible à tout le foyer. C'est la réponse directe au « je ne vais pas tout re-saisir ».
2. **Le foyer lisible depuis l'agenda qu'on utilise déjà.** Le flux `.ics` expose les événements du groupe : le conjoint qui refuse de changer d'application voit quand même les rendez-vous de la famille dans Google ou Apple Agenda. **On n'exige pas la migration.** C'est rare, et c'est vendeur.
3. **L'échéance sortie de la tête.** Une tâche `PLANNED` avec date et rappel tient une échéance administrative — avec les réserves du §4.

---

## 4. Ce qui manque — et ce qu'on a donc le droit de dire

Écart entre ce que l'axe exige (§2) et ce que le code fait (§3). Le verdict de la dernière colonne est **contraignant pour la rédaction de la page**.

| # | Manque | Constat dans le code | Impact sur la promesse | Verdict |
|---|---|---|---|---|
| 1 | **L'assistant IA ne touche pas au calendrier** | 20 outils MCP : 11 recettes/courses, 4 todos, 4 listes, 1 groupes. **Zéro calendrier.** | Le différenciant n°1 de l'étude (« l'IA écrit à ta place ») **ne couvre pas le rendez-vous**. « Ajoute le RDV pédiatre jeudi 15 h » ne fonctionne pas. | 🔴 **Ne pas dire.** Chantier prioritaire |
| 2 | **Le rappel ne part qu'au créateur** | `api/cron/notify` notifie `todo.user.email` / `event.user.email` | Un rendez-vous partagé s'affiche pour tous mais **ne rappelle rien à personne d'autre**. L'autre parent voit — il n'est pas alerté. | 🔴 **Ne pas dire** « toute la famille est prévenue » |
| 3 | **Pas de récurrence annuelle** | `Recurrence = daily \| weekly \| biweekly \| monthly` | L'échéance administrative type est **annuelle ou pluriannuelle**. La famille d'objets la plus lucrative n'est pas modélisable. | 🔴 Chantier prioritaire |
| 4 | **Un seul rappel, exprimé en minutes** | `notifyBefore: Int` + `notified: Boolean` ; libellé UI « Rappel email (minutes avant) » | Un J-30 se saisit en tapant « 43200 ». Et une fois parti, **plus rien** : pas de relance J-7 ni J-1. L'admin vit de relances. | 🟠 À construire avant d'en parler |
| 5 | **Aucune assignation** | Ni `Todo` ni `CalendarEvent` n'ont de champ assigné | On partage l'information, on n'attribue pas la responsabilité. **« Qui emmène au pédiatre ? » reste sans réponse** — c'est pourtant le cœur du rééquilibrage promis au persona 2. | 🟠 Chantier à fort effet de levier |
| 6 | **Pas de pièce jointe** | Aucun modèle `Document` au schéma ; le seul envoi de fichier existant est la photo de recette | La famille « dossier » (§2) est **hors périmètre**. Pas d'ordonnance, pas d'attestation, pas de carnet de santé. | 🔴 **Ne rien promettre.** Décision produit à prendre (§12) |
| 7 | **Pas de catégorie d'événement** | `CalendarEvent` a une couleur libre, pas de type | Impossible d'offrir une vue « santé », « école », « administratif », ni la moindre statistique. La couleur en tient lieu — à la main. | 🟡 Contournable, à ne pas survendre |

> **Règle d'or de ce volet :** la page ne peut pas vendre l'axe administratif plus fort que le produit ne le tient. Trois chantiers — **outils MCP calendrier (1)**, **récurrence annuelle (3)**, **rappel à tout le groupe (2)** — suffisent à rendre l'axe pleinement vendable. Tant qu'ils ne sont pas faits, la page s'en tient au §3.

---

## 5. Le paysage concurrentiel sur cet axe

| Acteur | Ce qu'il fait bien | Ce qu'il ne fait pas |
|---|---|---|
| **Google / Apple Agenda** | Le standard, déjà installé, partage fiable | Aucune tâche liée, aucune pièce, aucune notion de responsable. Un rendez-vous y est une ligne, pas un dossier |
| **Cozi** | Référence du calendrier familial, code couleur par membre, listes | Pas de suivi de démarche, pas de documents, très peu ancré dans les usages français |
| **FamilyWall** | Calendrier + messagerie + géolocalisation, positionné foyer | Même angle mort : l'administratif n'est pas un objet de première classe |
| **TimeTree** | Meilleur gratuit, sync Google bidirectionnelle, un fil de discussion par événement | Reste un agenda. Ni échéances longues, ni pièces, ni tâches |
| **Doctolib** | Prend le rendez-vous médical et envoie le rappel | Un silo par praticien, côté patient uniquement. **L'information ne rejoint jamais le foyer** |
| **Digiposte** (La Poste) | Coffre-fort numérique, collecte automatique des justificatifs (CAF, impôts, mutuelle), rappels d'échéances de contrats, hébergement en France, 10 M+ d'utilisateurs | **Stocke, mais n'organise pas la vie du foyer.** Ni agenda, ni tâches, ni répartition entre parents |
| **Pronote / EcoleDirecte / Klassroom** | Le canal officiel de l'école | Consultation seule, cloisonné par établissement, rien n'en ressort vers l'organisation familiale |
| **Todoist / TickTick** | Récurrences puissantes, rappels solides | Objets individuels : ni foyer, ni pièce jointe, ni rendez-vous partagé |
| **Le papier** (pochette, frigo, agenda mural) | Zéro friction, vraiment partagé | Ne suit personne, ne rappelle rien |

### Le trou, formulé précisément

La chaîne réelle d'un acte administratif familial est :

> **un rendez-vous → une tâche préparatoire → une pièce à fournir → une personne responsable.**

Chaque acteur du marché en tient **un maillon** : les agendas savent *quand*, les coffres-forts savent *où sont les papiers*, les messageries savent *qui en a parlé*. **Personne ne tient la chaîne entière, et personne ne répond à *qui s'en occupe*.** C'est exactement l'argument « quatre applications qui ne se parlent pas » de l'étude fondatrice, transposé au cycle long — et il y est **plus fort**, parce que la couture manuelle y est plus rare, donc plus facile à oublier.

MindDump est structurellement bien placé : tâches, calendrier et groupes partagent déjà le même modèle de données. Il manque trois chantiers, pas une refonte.

---

## 6. Positionnement de l'axe

**Formulation canonique :**

> Les rendez-vous, les échéances et les papiers de la famille ne vivent plus dans une seule tête — ils vivent au même endroit, et ils préviennent à temps.

**Trois formulations à tester :**

| # | Accroche | Registre | Quand la préférer |
|---|---|---|---|
| **A** | **L'autre charge mentale : celle qui a une date limite.** | Nomme un impensé | ★ **Recommandée** en titre de section — elle installe une catégorie que le visiteur reconnaît sans l'avoir jamais nommée |
| **B** | **Le rendez-vous pris sur ton téléphone, toute la famille le sait.** | Concret, démontrable | Si la section suit immédiatement la démonstration de l'abonnement iCal |
| **C** | **Ce qui s'oublie une fois par an est ce qui coûte le plus cher.** | Évitement de perte | En accroche des pages SEO « échéances », là où l'intention de recherche est déjà anxieuse |

**Recommandation : A en titre de section, B en sous-titre.** On nomme la catégorie, puis on prouve immédiatement — sinon « l'autre charge mentale » reste une formule.

### Ce que ce volet ne change pas

**Le H1 de la page reste « Vide ta charge mentale ».** L'axe administratif est le **second pilier**, pas le nouveau message d'accueil, pour trois raisons :

1. La boucle repas est la seule qui se **démontre au scroll** de façon spectaculaire. Une échéance annuelle n'a pas d'animation à offrir.
2. Le repas est quotidien : c'est ce qui fait ouvrir l'app la première semaine.
3. « Charge mentale » couvre déjà les deux moitiés — le terme est assez large, c'est la *page* qui l'a rétréci aux repas.

En revanche, la hiérarchie des sections change (§8) : l'axe passe du 5ᵉ rang décoratif à une **section à part entière**.

---

## 7. Personas — extension

Les trois personas de l'étude fondatrice restent valables. Le cycle long en révèle deux autres, et déplace le premier.

### Camille (persona 1) — revisitée : « le cerveau de garde »

Sa frustration citée dans l'étude — *« je suis la seule à savoir quand est le rendez-vous dentiste »* — est **déjà** une frustration administrative. Elle a été traitée comme un exemple ; c'est en réalité une catégorie.

- **Ce qui la fait basculer :** pas de gagner dix minutes, mais de **cesser d'être le seul système d'alerte du foyer**.
- **Message :** *Tu n'es plus la seule à savoir. Tu n'es plus la seule à y penser à temps.*

### Persona 4 — Le foyer en garde alternée ou recomposé

Deux domiciles, un planning de garde, des rendez-vous qui doivent survivre au passage d'un foyer à l'autre.

- **Frustration :** « Le rendez-vous orthophoniste tombe sur sa semaine — est-ce qu'il le sait ? Est-ce qu'il l'a noté ? » Le doute coûte plus cher que l'oubli.
- **Ce que MindDump résout aujourd'hui :** l'agenda partagé et l'invitation par lien créent un espace **neutre**, consultable sans passer par l'autre parent. Le flux `.ics` permet à chacun de garder son propre agenda.
- **Ce qui manque :** l'assignation (manque n°5) est ici **bloquante** — c'est toute la question.
- **Message :** *Un calendrier commun, deux maisons. Personne n'a besoin de demander.*

### Persona 5 — L'aidant de la génération pivot

Enfants d'un côté, parents vieillissants de l'autre. Rendez-vous médicaux, dossiers mutuelle, démarches longues.

- **Frustration :** gérer l'administratif de quelqu'un d'autre, sans avoir accès à ses papiers ni à sa mémoire.
- **Ce que MindDump résout aujourd'hui :** le groupe n'est pas « la famille nucléaire » — c'est un **périmètre de partage arbitraire**. Un groupe « Papa » est parfaitement légitime, et ses réglages de partage (`shareTodos`, `shareCalendar`, `shareLists`, `shareRecipes`) permettent de n'y ouvrir que le calendrier et les tâches.
- **Ce qui manque :** les pièces jointes (n°6) et la relance de démarche (n°4).
- **Message :** *Un espace par personne dont tu t'occupes.*

> **Note de portée.** Ces deux personas sont des **cibles secondaires** : ils justifient des pages de contenu et des formulations, pas une refonte du hero. La cible principale reste le foyer avec enfants.

---

## 8. Hiérarchie des messages révisée

Remplace la liste du §5 de l'étude fondatrice.

| Rang | Message | Évolution |
|---|---|---|
| 1 | Recette → liste de courses automatique | inchangé |
| 2 | La photo → l'app (assistant IA) | inchangé |
| 3 | **Rendez-vous et échéances : le foyer prévenu, pas une seule personne** | ⬆ **nouveau, remonté du 5ᵉ rang** |
| 4 | Import multi-sources | ⬇ −1 |
| 5 | Partage familial | inchangé dans l'esprit, désormais **illustré par le rendez-vous** plutôt que par la liste de courses |
| 6 | Semainier enfant | inchangé (grille des modules) |

### Où l'insérer dans la page

`02-ux-ui.md` décrit sept sections. L'axe s'insère **en section 5 bis, entre les modules et le foyer** : après avoir montré l'étendue, avant de parler de partage — c'est le pont naturel entre « l'app fait beaucoup » et « l'app est à plusieurs ».

**Traitement visuel recommandé** — sobre, en contraste délibéré avec les deux démonstrations animées qui précèdent :

- Un **calendrier de foyer** où trois sources convergent : les événements saisis, un calendrier externe abonné (école), et le rappel sortant. Trois flux entrants, une seule vue.
- **Pas de scrub.** Un reveal simple. La section qui suit l'assistant IA doit redescendre en intensité, sinon la page devient épuisante — la règle « une section = une idée = une animation » l'impose.
- Le décor manuscrit du hero (« rdv pédiatre », « relancer le plombier ») **se referme ici** : ces deux notes exactes réapparaissent, cette fois rangées et datées. La boucle narrative ouverte au premier écran trouve sa fin.

---

## 9. Objections spécifiques à cet axe

Elles sont différentes de celles de l'axe repas : plus défensives, et deux d'entre elles portent sur la confiance.

| Objection | Réponse dans la page |
|---|---|
| *« Mon agenda est déjà dans Google »* | Ne pas contredire. Montrer le flux `.ics` : le calendrier du foyer **se lit depuis Google ou Apple Agenda**. On n'impose pas de migration — c'est un argument que Cozi ne peut pas tenir (sa synchronisation est en lecture seule). |
| *« Doctolib m'envoie déjà un SMS »* | À l'intéressé seulement. Le sujet n'est pas le rappel, c'est que **l'autre parent, lui, ne sait rien**. Recadrer du rappel individuel vers l'information partagée. |
| *« Je ne vais pas re-saisir tous mes rendez-vous »* | L'abonnement iCal : le calendrier de l'école, du club ou l'agenda perso s'aspirent et s'affichent pour tout le foyer. Zéro saisie. |
| *« Mes papiers médicaux dans une app ? »* | Ne pas esquiver : **aujourd'hui l'app ne stocke aucun document** (manque n°6) — et ne rien prétendre d'autre. Afficher l'auto-hébergement et l'isolation par groupe. Si les pièces jointes sont construites un jour, cette objection devient la première à traiter. |
| *« Encore un endroit où regarder »* | Les feature flags : on active calendrier et tâches, sans le reste. Et le flux `.ics` fait que l'endroit où l'on regarde **peut rester l'ancien**. |

---

## 10. La démonstration honnête

Ce qui peut être montré **maintenant**, sans dette :

1. **Le calendrier de l'école, dans celui du foyer.** Collage d'une URL iCal → les dates apparaissent pour tous les membres. Vrai, implémenté, partagé au groupe.
2. **Le foyer visible depuis Google Agenda.** Le flux `.ics` par jeton, avec les événements du groupe inclus. Vrai, et rare sur ce marché.
3. **L'échéance qui prévient.** Tâche `PLANNED` + date + rappel e-mail. Vrai — en s'en tenant à *la personne est prévenue*, jamais *la famille est prévenue*.

Ce qui reste **interdit de page** tant que les chantiers du §4 ne sont pas faits :

- ❌ « Dis à ton assistant d'ajouter le rendez-vous » — aucun outil MCP calendrier n'existe.
- ❌ « Toute la famille reçoit le rappel » — le rappel ne part qu'au créateur.
- ❌ « N'oublie plus jamais une échéance annuelle » — la récurrence annuelle n'existe pas.
- ❌ Toute image montrant une ordonnance, une attestation ou un document stocké.

---

## 11. SEO — requêtes et guides à produire

L'axe administratif a un avantage décisif sur l'axe repas : **l'intention de recherche y est urgente et datée**. On ne cherche pas « comment m'organiser » ; on cherche « quand je dois faire X ». Le trafic est plus qualifié, et moins disputé par les grandes marques.

| Famille de requêtes | Intention | Guide cible |
|---|---|---|
| « organiser les rendez-vous de la famille », « agenda familial partagé rendez-vous médicaux » | Comparaison, prêt à installer | `rendez-vous-famille` |
| « ne pas oublier les échéances », « rappel annuel assurance / contrôle technique / vaccin » | Peur de l'oubli, très transactionnelle | `echeances-administratives-famille` |
| « qui s'occupe de quoi à la maison », « répartir la charge mentale en couple » | Conflit, en recherche de méthode | `repartir-les-taches-du-foyer` |
| « organisation garde alternée », « calendrier garde alternée partagé » | Situation subie, forte rétention | (persona 4 — à traiter dans `rendez-vous-famille`, section dédiée) |

**Deux guides prioritaires**, au format de `src/lib/content/guides.ts` :

1. **`rendez-vous-famille`** — *« Les rendez-vous de la famille : arrêter d'être le seul à les connaître »*
   Angle : le rendez-vous n'est pas un problème de mémoire mais de diffusion. Sections : ce qui échoue (le SMS sur un seul téléphone) · les quatre familles d'objets du §2 · agréger plutôt que re-saisir (iCal) · rester lisible depuis l'agenda existant (`.ics`) · la question ouverte de *qui y va*. `related` : `calendrier-familial-partage`, `charge-mentale`.

2. **`echeances-administratives-famille`** — *« Les échéances du foyer : ce qui s'oublie une fois par an »*
   Angle : l'inventaire annuel — assurance, contrôle technique, rappels vaccinaux, impôts, inscriptions, renouvellement de papiers d'identité. La page a une valeur d'usage **avant même l'inscription**, ce qui en fait un bon aimant à liens. `related` : `charge-mentale`, `rendez-vous-famille`.

> ⚠️ Le second guide **suppose la récurrence annuelle** (manque n°3). Publier une page sur les échéances annuelles avec un produit qui plafonne au mensuel expose à une déception mesurable au rebond. **Ordre imposé : le chantier, puis la page.**

**Rappel mécanique**, d'après l'en-tête de `guides.ts` : un guide = une entrée dans `GUIDES` + un dossier `src/app/<slug>/page.tsx` + une ligne dans `src/app/sitemap.ts`. Penser aussi à ajouter les nouveaux slugs au `related` des guides existants — `calendrier-familial-partage` en premier, c'est le voisin le plus proche.

---

## 12. Séquencement recommandé

**Vague 1 — sans une ligne de code applicatif.**
Section « L'autre charge mentale » dans la landing (§8), adossée aux trois preuves du §10. Guide `rendez-vous-famille`. Referme la promesse ouverte par les notes du hero.

**Vague 2 — les trois chantiers qui rendent l'axe vendable.**
Récurrence annuelle (n°3) · rappel à tous les membres du groupe (n°2) · outils MCP calendrier (n°1). Le troisième est le plus rentable en termes de récit : il étend le différenciant le plus défendable de l'app — « l'IA écrit à ta place » — à la moitié de la charge mentale qu'il ne couvre pas encore. Débloque le guide `echeances-administratives-famille` et l'accroche C.

**Vague 3 — décision produit, pas décision marketing.**
L'assignation (n°5) et les pièces jointes (n°6) ouvrent la famille « dossier » et la famille « démarche », donc un second pilier complet face à Digiposte — mais sur un terrain (documents personnels, données de santé) qui engage stockage, sécurité et discours de confiance. **À ne pas entamer pour servir une accroche.**

---

## 13. Garde-fous rédactionnels

Ce qu'on ne dira jamais sur cet axe :

- Rien qui laisse croire à un **stockage de documents** tant que le modèle n'existe pas.
- Rien qui laisse croire que l'app **prend** les rendez-vous. Elle les héberge et les diffuse ; Doctolib les prend.
- Aucune allusion à un **suivi médical** : le semainier enfant note une humeur et une sieste, ce n'est pas un carnet de santé, et le vocabulaire médical déclencherait des attentes réglementaires que rien ne soutient.
- Aucune **statistique anxiogène brute** en accroche. Les chiffres du §1 servent à cadrer la stratégie ; en page, ils sonneraient comme un argumentaire d'assureur. La reconnaissance vaut mieux que la peur.

---

## Sources

- INSEE, enquête *Emploi du temps* — répartition des tâches domestiques et parentales.
- [Ipsos — « Charge mentale : 8 femmes sur 10 seraient concernées »](https://www.ipsos.com/fr-fr/charge-mentale-8-femmes-sur-10-seraient-concernees)
- [CNRS — « Trois choses à savoir sur la charge mentale »](https://www.cnrs.fr/fr/actualite/trois-choses-savoir-sur-la-charge-mentale)
- Conseil national de l'Ordre des médecins / Académie de médecine — rendez-vous non honorés (6 à 10 %).
- [Digiposte — coffre-fort numérique et usage familial (La Poste)](https://www.laposte.fr/digiposte/famille)
- [Comparatifs d'applications de calendrier familial 2026 — Mailfence](https://blog.mailfence.com/fr/calendrier-familial-application-comparatif/) et [Linote](https://linote.fr/blog/application-agenda-partage-famille-gratuit/) (Cozi, FamilyWall, TimeTree)
- [Calendrier vaccinal et rappels — ameli.fr](https://www.ameli.fr/assure/sante/themes/vaccination/faire-vacciner)
