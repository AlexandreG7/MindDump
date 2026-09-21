/**
 * Pages de contenu publiques, destinées à la recherche Google.
 *
 * Chaque guide vise une famille de requêtes que des gens tapent réellement
 * (« charge mentale », « liste de courses partagée »...), et illustre les
 * usages de MindDump. Tout ce qui est décrit ici doit exister dans l'app :
 * une promesse fausse coûte plus cher qu'une page en moins.
 *
 * Ajouter un guide = une entrée ici + un dossier src/app/<slug>/page.tsx +
 * une ligne dans src/app/sitemap.ts.
 */

export type GuideSection = {
  heading: string;
  paragraphs: string[];
  bullets?: { title: string; body: string }[];
};

export type Guide = {
  slug: string;
  /** Titre de l'onglet et des résultats Google (le layout ajoute « · MindDump »). */
  metaTitle: string;
  /** Meta description : ~155 caractères, c'est ce qui décide du clic. */
  metaDescription: string;
  eyebrow: string;
  /** Libellé court, pour les liens de navigation entre guides. */
  navLabel: string;
  /** H1 de la page, unique sur le site. */
  title: string;
  intro: string;
  sections: GuideSection[];
  faq: { question: string; answer: string }[];
  /** Slugs des guides liés, pour le maillage interne. */
  related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "charge-mentale",
    metaTitle: "Charge mentale familiale : la comprendre et la partager vraiment",
    metaDescription:
      "Pourquoi la charge mentale pèse sur une seule personne, ce qui ne marche pas pour l'alléger, et comment sortir la liste de ta tête pour la rendre partageable.",
    eyebrow: "Le sujet de fond",
    navLabel: "Charge mentale",
    title: "La charge mentale familiale : la comprendre, puis la partager",
    intro:
      "La charge mentale, ce n'est pas la vaisselle. C'est se souvenir qu'il n'y a plus de liquide vaisselle, savoir depuis quand, et y penser au bon moment — avant le magasin, pas après. C'est un travail invisible, permanent, et il repose presque toujours sur la même personne du foyer.",
    sections: [
      {
        heading: "Ce qui pèse n'est pas la tâche, c'est de la porter",
        paragraphs: [
          "Faire les courses prend une heure. Savoir ce qu'il faut acheter prend toute la semaine. C'est cette différence que recouvre l'expression « charge mentale » : le travail d'anticipation, de suivi et de rappel qui précède chaque tâche visible.",
          "Ce travail a trois propriétés qui le rendent épuisant. Il ne s'arrête jamais : on y pense sous la douche, en réunion, à 3 h du matin. Il est invisible : personne ne remercie pour une pensée. Et il ne se délègue pas en bloc, parce qu'il vit dans une seule tête.",
          "D'où le déséquilibre classique du foyer : l'un exécute quand on lui demande, l'autre décide quoi demander. Répartir les tâches à parts égales ne change rien à ce déséquilibre-là. Tant que le fichier maître reste dans une seule mémoire, la personne qui le détient reste de garde.",
        ],
      },
      {
        heading: "Pourquoi les solutions habituelles ne tiennent pas",
        paragraphs: [
          "La plupart des tentatives échouent pour la même raison : elles demandent encore plus de travail à la personne déjà surchargée.",
        ],
        bullets: [
          {
            title: "« Demande-moi et je le fais »",
            body: "La demande est justement le travail. Il faut savoir quoi demander, à quel moment, et vérifier ensuite. La charge reste entière, on a juste ajouté une étape.",
          },
          {
            title: "Le tableau blanc de la cuisine",
            body: "Il ne suit personne au magasin, ne rappelle rien, et ne se met à jour que si quelqu'un y pense. Il marche pour les listes stables, pas pour une semaine réelle.",
          },
          {
            title: "Quatre applications séparées",
            body: "Une pour les notes, une pour les courses, une pour le calendrier, une pour les recettes. Chacune fonctionne. Ensemble, elles obligent à retenir où se trouve quoi — et à tout ressaisir d'une app à l'autre.",
          },
          {
            title: "La discussion de groupe",
            body: "Tout y passe, donc rien ne s'y retrouve. Une information écrite mardi est enterrée jeudi, et personne ne sait si elle a été traitée.",
          },
        ],
      },
      {
        heading: "Ce qui marche : rendre la liste consultable sans toi",
        paragraphs: [
          "La charge se partage à une condition : que l'information sorte de ta tête et devienne accessible aux autres sans passer par toi. Pas « je te dis quoi faire », mais « regarde, c'est là ».",
          "Concrètement, cela veut dire trois choses. Un seul endroit, sinon on recrée le problème ailleurs. Un accès commun, pour que l'autre puisse ouvrir et voir — pas demander. Et une capture assez rapide pour que déposer une pensée coûte moins cher que de la retenir.",
          "C'est exactement ce que MindDump essaie d'être : l'endroit où tu déposes ce que tu as en tête, pour que ce soit l'app qui le retienne, et le foyer entier qui puisse le consulter.",
        ],
        bullets: [
          {
            title: "Déposer plutôt que retenir",
            body: "Les tâches acceptent une priorité et une échéance, et ce qui est urgent remonte tout seul. Les rappels partent par e-mail, pour que tu n'aies pas à surveiller l'app.",
          },
          {
            title: "Un foyer, pas un compte",
            body: "Tu invites ta famille avec un lien. Les tâches, les courses, les recettes et le calendrier deviennent communs — et la personne qui ouvre l'app voit la même chose que toi.",
          },
          {
            title: "Les repas, source n°1 de charge",
            body: "Une recette importée depuis HelloFresh, Jow ou Quitoque arrive complète, et sa liste de courses se génère d'un geste. La question « on mange quoi ? » cesse d'être une décision quotidienne.",
          },
          {
            title: "Dicter au lieu de saisir",
            body: "MindDump se connecte à un assistant IA : tu peux lui demander d'ajouter des tâches ou un rendez-vous, d'importer une recette ou de remplir la liste de courses en langage courant, et c'est écrit dans l'app.",
          },
        ],
      },
      {
        heading: "Par où commencer cette semaine",
        paragraphs: [
          "Inutile de tout réorganiser d'un coup. La bascule se fait en trois soirées.",
          "Premier soir : vide ta tête. Tout ce qui traîne, sans trier, sans prioriser — la liste sera longue, c'est normal, elle était déjà là. Deuxième soir : invite la personne avec qui tu partages le foyer et parcourez la liste ensemble une fois. Troisième soir : planifie quatre repas et génère la liste de courses.",
          "À partir de là, l'habitude tient toute seule, parce que déposer devient plus simple que retenir. Et tu n'es plus la seule personne à savoir ce qu'il reste à faire.",
        ],
      },
    ],
    faq: [
      {
        question: "Qu'est-ce que la charge mentale, exactement ?",
        answer:
          "C'est le travail invisible d'anticipation, d'organisation et de suivi qui précède les tâches domestiques : penser à ce qu'il faut acheter, retenir les rendez-vous, vérifier que ce qui a été demandé a bien été fait. Ce n'est pas l'exécution, c'est la gestion permanente.",
      },
      {
        question: "Comment partager la charge mentale dans un couple ?",
        answer:
          "En sortant l'information d'une seule tête. Tant que l'un doit demander à l'autre, la charge reste chez celui qui demande. Un espace commun où chacun peut consulter et ajouter — tâches, courses, calendrier — transfère une partie de ce travail à l'outil plutôt qu'à une personne.",
      },
      {
        question: "Une application peut-elle vraiment réduire la charge mentale ?",
        answer:
          "Elle ne fait pas les tâches à ta place, mais elle enlève la partie la plus coûteuse : retenir. À condition qu'elle soit partagée avec le foyer et assez rapide pour qu'y déposer une pensée prenne moins d'effort que de la garder en tête.",
      },
      {
        question: "MindDump est-il fait pour les familles ou aussi pour une personne seule ?",
        answer:
          "Les deux. Seul, il sert d'endroit unique pour les tâches, les repas et les courses. À plusieurs, il devient un espace commun où chacun voit et met à jour la même chose.",
      },
    ],
    related: ["liste-de-courses-partagee", "menus-de-la-semaine", "rendez-vous-famille"],
  },
  {
    slug: "liste-de-courses-partagee",
    metaTitle: "Liste de courses partagée : la tenir à deux sans se répéter",
    metaDescription:
      "Une liste de courses commune que chacun peut ouvrir et cocher, générée depuis les repas de la semaine. Fini le SMS « tu peux prendre du lait ? » en pleine réunion.",
    eyebrow: "Cas d'usage",
    navLabel: "Liste de courses partagée",
    title: "La liste de courses partagée, à deux et sans se répéter",
    intro:
      "La liste de courses est le meilleur test d'une organisation familiale : elle change tous les jours, plusieurs personnes y touchent, et une oubli se paie tout de suite. C'est aussi le premier endroit où une app partagée se rend utile.",
    sections: [
      {
        heading: "Le problème n'est pas d'écrire la liste, c'est de la tenir à jour",
        paragraphs: [
          "Une liste sur un bout de papier est parfaite jusqu'au moment où quelqu'un d'autre passe au magasin. Une liste dans une note privée oblige à l'envoyer, donc à la recopier. Une liste dans une discussion se perd sous les messages du jour.",
          "Résultat, le même scénario revient chaque semaine : deux personnes achètent le même paquet de pâtes, personne n'achète le dentifrice, et celle qui tient la liste finit par y aller elle-même parce que c'est plus rapide que d'expliquer.",
        ],
      },
      {
        heading: "Ce que change une liste réellement commune",
        paragraphs: [
          "Dans MindDump, les listes appartiennent au foyer, pas à un compte. Tu invites ta famille avec un lien, et tout le monde voit la même liste.",
        ],
        bullets: [
          {
            title: "Cochée à deux, en même temps",
            body: "Chacun avance dans son rayon, et ce qui est pris disparaît pour l'autre. Plus besoin de s'appeler au milieu du magasin.",
          },
          {
            title: "Générée depuis les repas",
            body: "Tu choisis les recettes de la semaine, et la liste se remplit avec leurs ingrédients d'un geste, sans rien recopier.",
          },
          {
            title: "Plusieurs listes en parallèle",
            body: "Le supermarché, le marché, le bricolage, la pharmacie. Chaque liste reste courte et lisible au lieu de mélanger cinquante lignes.",
          },
          {
            title: "Remplie à la voix",
            body: "Via l'assistant IA connecté à MindDump, « ajoute du dentifrice et des piles AA à la liste de courses » suffit — la ligne apparaît dans l'app.",
          },
        ],
      },
      {
        heading: "Le vrai gain : personne n'a plus à demander",
        paragraphs: [
          "Une liste partagée déplace une charge qu'on ne voit pas : celle de l'intermédiaire. Sans elle, la personne qui sait doit être jointe, disponible, et capable de se souvenir sur le moment. Avec elle, celle qui passe devant le magasin ouvre l'app et sait.",
          "C'est un petit changement d'usage, mais c'est précisément la mécanique qui allège la charge mentale : remplacer « demande-moi » par « regarde ».",
        ],
      },
    ],
    faq: [
      {
        question: "Comment créer une liste de courses partagée avec son conjoint ?",
        answer:
          "Crée un compte MindDump, crée une liste, puis invite l'autre personne dans ton foyer avec un lien. La liste devient visible et modifiable par vous deux, sans configuration supplémentaire.",
      },
      {
        question: "Peut-on cocher les articles à deux en même temps ?",
        answer:
          "Oui. La liste est commune au foyer : ce qu'une personne coche disparaît pour l'autre, ce qui permet de se répartir les rayons sans se téléphoner.",
      },
      {
        question: "Peut-on générer la liste à partir des recettes de la semaine ?",
        answer:
          "Oui, c'est l'usage principal. Une recette importée depuis HelloFresh, Jow ou Quitoque arrive avec ses ingrédients, et tu envoies ceux-ci vers une liste de courses en un geste.",
      },
    ],
    related: ["menus-de-la-semaine", "charge-mentale", "calendrier-familial-partage"],
  },
  {
    slug: "menus-de-la-semaine",
    metaTitle: "Menus de la semaine : planifier les repas sans y repenser chaque soir",
    metaDescription:
      "Planifier les repas de la semaine en une fois, importer ses recettes depuis HelloFresh, Jow ou Quitoque, et en tirer la liste de courses sans rien recopier.",
    eyebrow: "Cas d'usage",
    navLabel: "Menus de la semaine",
    title: "Planifier les menus de la semaine, une fois pour toutes",
    intro:
      "« On mange quoi ce soir ? » est la question la plus coûteuse de la journée. Posée à 19 h, fatigué, avec un frigo à moitié plein, elle se termine en pâtes ou en livraison. Planifier ne sert pas à manger mieux par principe : ça sert à ne plus avoir à décider au pire moment.",
    sections: [
      {
        heading: "Décider une fois plutôt que sept",
        paragraphs: [
          "Une décision prise le dimanche coûte une fraction de la même décision prise en semaine, parce qu'elle est prise au calme, avec le temps de regarder ce qu'il reste et ce qui plaît à tout le monde.",
          "Le vrai frein n'est pas la planification, c'est la recopie : trouver des recettes ici, noter les ingrédients là, refaire la liste de courses ailleurs. Quand chaque étape demande de ressaisir, l'habitude ne tient pas trois semaines.",
        ],
      },
      {
        heading: "De la recette au caddie sans ressaisie",
        paragraphs: [
          "MindDump enchaîne les trois étapes qui sont d'habitude séparées.",
        ],
        bullets: [
          {
            title: "Import depuis HelloFresh, Jow et Quitoque",
            body: "Colle le lien d'une recette repérée le matin : titre, ingrédients, temps et portions arrivent entiers dans ton catalogue.",
          },
          {
            title: "Planification dans le calendrier",
            body: "Place les recettes sur les jours de la semaine. Les repas prévus apparaissent dans le calendrier familial, à côté du reste.",
          },
          {
            title: "Liste de courses en un geste",
            body: "Les ingrédients des recettes choisies partent vers une liste de courses partagée, que tout le foyer peut cocher.",
          },
          {
            title: "Mode cuisine",
            body: "Au moment de cuisiner, la recette s'affiche en plein écran et l'écran reste allumé — les mains dans la pâte, on ne réveille pas son téléphone toutes les trente secondes.",
          },
        ],
      },
      {
        heading: "Et quand on n'a aucune idée",
        paragraphs: [
          "Le plus dur reste de trouver quoi cuisiner. MindDump se connecte à un assistant IA : tu peux lui demander des idées à partir de ce qu'il te reste, lui faire importer une recette, ou photographier ton frigo pour en tirer une proposition — et ce qui est retenu atterrit directement dans ton catalogue et tes courses.",
          "Le catalogue se construit tout seul au fil des semaines. Au bout d'un mois ou deux, planifier revient à repiocher dans ce que la famille a déjà aimé, ce qui prend quelques minutes.",
        ],
      },
    ],
    faq: [
      {
        question: "Comment organiser les menus de la semaine sans y passer des heures ?",
        answer:
          "Choisis quatre ou cinq repas seulement, pas sept : il reste toujours des restes et un imprévu. Pioche dans un catalogue de recettes déjà testées, place-les sur les jours, puis génère la liste de courses à partir de cette sélection.",
      },
      {
        question: "Peut-on importer des recettes de HelloFresh, Jow ou Quitoque ?",
        answer:
          "Oui. En collant le lien de la recette, MindDump récupère les ingrédients, le temps de préparation et le nombre de portions, et l'ajoute à ton catalogue.",
      },
      {
        question: "Les repas planifiés apparaissent-ils dans le calendrier ?",
        answer:
          "Oui, les repas prévus s'affichent dans le calendrier familial, avec le reste des événements de la semaine.",
      },
    ],
    related: ["liste-de-courses-partagee", "charge-mentale", "calendrier-familial-partage"],
  },
  {
    slug: "calendrier-familial-partage",
    metaTitle: "Calendrier familial partagé : tout le foyer sur la même semaine",
    metaDescription:
      "Rassembler les rendez-vous, les activités des enfants et les repas prévus dans un calendrier familial partagé, sans abandonner les agendas que vous utilisez déjà.",
    eyebrow: "Cas d'usage",
    navLabel: "Calendrier familial",
    title: "Un calendrier familial partagé, sans tout recommencer",
    intro:
      "Dans un foyer, l'information de la semaine est éparpillée : un agenda professionnel, un carnet de correspondance, un SMS de la nounou, et la mémoire de la personne qui centralise. Un calendrier familial ne sert pas à remplacer tout ça — il sert à ce que la semaine soit lisible par tout le monde au même endroit.",
    sections: [
      {
        heading: "Le problème des agendas déjà en place",
        paragraphs: [
          "Personne n'abandonne son agenda professionnel, et c'est bien normal. C'est la raison pour laquelle la plupart des calendriers familiaux échouent : ils demandent de tout ressaisir ailleurs, donc ils se vident au bout de trois semaines.",
          "MindDump prend le problème dans l'autre sens : tu t'abonnes aux agendas que tu utilises déjà, et tu exportes le calendrier du foyer vers eux. Les deux mondes restent synchronisés sans double saisie.",
        ],
      },
      {
        heading: "Ce que le calendrier du foyer rassemble",
        paragraphs: [
          "L'intérêt d'un calendrier commun n'est pas de tout contenir, mais de rendre visible ce qui concerne plusieurs personnes.",
        ],
        bullets: [
          {
            title: "Les rendez-vous qui engagent quelqu'un d'autre",
            body: "Le pédiatre du jeudi, le rendez-vous chez le notaire, la réunion de parents : ceux où il faut savoir qui y va.",
          },
          {
            title: "Les agendas externes, par abonnement",
            body: "Abonne-toi aux calendriers que tu as déjà au format .ics, et retrouve-les dans la vue du foyer sans les recopier.",
          },
          {
            title: "Le calendrier du foyer, exportable",
            body: "Exporte-le en .ics pour l'afficher dans l'agenda que tu consultes toute la journée.",
          },
          {
            title: "Les repas de la semaine",
            body: "Les recettes planifiées apparaissent sur les bons jours : la semaine se lit d'un coup d'œil, repas compris.",
          },
          {
            title: "La journée des enfants",
            body: "Le semainier suit l'humeur, les siestes et les activités, et dégage les tendances sur le mois — utile quand on cherche à comprendre une mauvaise semaine.",
          },
        ],
      },
      {
        heading: "Un calendrier que les autres consultent vraiment",
        paragraphs: [
          "Un agenda partagé n'a de valeur que si les autres l'ouvrent. C'est pour ça que MindDump met le calendrier au même endroit que les tâches, les courses et les repas : on y va pour cocher la liste de courses, et on voit au passage qu'il y a le dentiste jeudi.",
          "C'est ce qui fait la différence entre un outil de plus et un endroit où le foyer passe — et la condition pour que la personne qui centralise cesse d'être le seul calendrier de la maison.",
        ],
      },
    ],
    faq: [
      {
        question: "Comment partager un calendrier familial entre plusieurs personnes ?",
        answer:
          "Invite les membres de ton foyer avec un lien : le calendrier devient commun, chacun voit les mêmes événements et peut en ajouter.",
      },
      {
        question: "Peut-on garder son agenda actuel ?",
        answer:
          "Oui. MindDump s'abonne aux calendriers externes au format .ics et exporte le calendrier du foyer dans le même format, ce qui évite de tout ressaisir dans un nouvel outil.",
      },
      {
        question: "Les repas planifiés apparaissent-ils dans le calendrier familial ?",
        answer:
          "Oui, les recettes que tu planifies s'affichent sur les jours correspondants, avec les autres événements de la semaine.",
      },
    ],
    related: ["rendez-vous-famille", "charge-mentale", "echeances-administratives-famille"],
  },
  {
    slug: "rendez-vous-famille",
    metaTitle: "Rendez-vous de la famille : arrêter d'être le seul à les connaître",
    metaDescription:
      "Pédiatre, dentiste, réunion de parents : organiser les rendez-vous de la famille pour que tout le foyer les connaisse et soit prévenu, sans tout re-saisir.",
    eyebrow: "Cas d'usage",
    navLabel: "Rendez-vous de la famille",
    title: "Les rendez-vous de la famille : arrêter d'être le seul à les connaître",
    intro:
      "Un rendez-vous chez le pédiatre ne s'oublie pas faute de mémoire. Il s'oublie parce que l'information est restée à un seul endroit : dans le SMS de confirmation, sur un seul téléphone, dans la tête de la personne qui l'a pris. Le problème n'est pas de s'en souvenir, c'est de le diffuser.",
    sections: [
      {
        heading: "Ce qui échoue : le SMS sur un seul téléphone",
        paragraphs: [
          "La plupart des rendez-vous du foyer se prennent en ligne ou au téléphone, et leur confirmation arrive chez celui qui les a pris. L'autre parent n'en sait rien, sauf si on pense à le lui dire — et à le lui redire la veille.",
          "Le rappel du cabinet médical ne change rien à ce déséquilibre : il prévient la personne qui savait déjà. Celle qui devait se libérer, garder le petit frère ou faire le trajet découvre le rendez-vous le jour même.",
        ],
      },
      {
        heading: "Tous les rendez-vous ne se ressemblent pas",
        paragraphs: [
          "Ranger tout dans un agenda est l'erreur classique. La charge administrative d'un foyer mélange en réalité quatre familles d'objets, qui n'ont ni le même rythme ni les mêmes besoins.",
        ],
        bullets: [
          {
            title: "Le rendez-vous",
            body: "Pédiatre, dentiste, orthophoniste, réunion de parents, garagiste. Daté à l'heure, il doit être connu de tous ceux qu'il concerne.",
          },
          {
            title: "L'échéance récurrente",
            body: "Assurance, contrôle technique, déclaration d'impôts, renouvellement de papiers. Elle revient une fois par an ou moins, et rien ne la rappelle entre deux fois.",
          },
          {
            title: "Le dossier",
            body: "Les pièces à réunir pour une inscription ou une démarche. Il se prépare en avance, avec une liste de choses à rassembler.",
          },
          {
            title: "La démarche",
            body: "Un remboursement, un dossier en attente, une résiliation. Elle vit de relances, et il faut savoir où elle en est.",
          },
        ],
      },
      {
        heading: "Agréger plutôt que re-saisir",
        paragraphs: [
          "Un calendrier familial qui exige de tout recopier se vide en trois semaines. Le bon réflexe est l'inverse : faire venir les dates là où le foyer regarde.",
          "Dans MindDump, tu abonnes le groupe à un calendrier externe au format iCal — celui de l'école, du club de sport, ou ton agenda personnel où arrivent déjà tes confirmations. Ses dates s'affichent pour tous les membres du foyer, sans une ligne de saisie. Pour le reste, un rendez-vous ajouté par l'un apparaît chez tous les autres.",
        ],
      },
      {
        heading: "Rester lisible depuis l'agenda qu'on utilise déjà",
        paragraphs: [
          "Personne n'abandonne son agenda, et il ne faut pas le demander. Le calendrier du foyer s'exporte en flux .ics : ajoute-le une fois dans Google Agenda ou Apple Agenda, et les rendez-vous de la famille apparaissent à côté des tiens.",
          "C'est ce qui rend l'outil tenable à deux : celui ou celle qui ne veut pas d'une application de plus voit quand même le pédiatre de jeudi, là où il regarde déjà.",
        ],
      },
      {
        heading: "Prévenir le foyer, pas seulement celui qui a noté",
        paragraphs: [
          "Un rendez-vous rattaché au groupe envoie son rappel par e-mail à chacun de ses membres, au délai choisi : la veille, une semaine avant, ou le matin même. L'autre parent n'a plus besoin qu'on pense à lui dire.",
          "Et si le rendez-vous se prend en passant, un assistant IA connecté à MindDump peut l'ajouter pour toi : « ajoute le rendez-vous chez le pédiatre jeudi à 15 h », et il est dans le calendrier du foyer.",
        ],
      },
      {
        heading: "La question qui reste : qui y va ?",
        paragraphs: [
          "Savoir qu'il y a un rendez-vous ne dit pas qui s'en occupe. MindDump ne désigne pas encore de responsable par événement. En attendant, la convention la plus simple marche bien : le prénom de la personne qui accompagne dans le titre (« Pédiatre — Léo, avec Camille »). Tout le foyer le lit, et personne n'a besoin de demander.",
        ],
      },
      {
        heading: "Deux maisons, un seul calendrier",
        paragraphs: [
          "En garde alternée, le doute coûte plus cher que l'oubli : le rendez-vous d'orthophonie tombe sur la semaine de l'autre parent, est-ce qu'il le sait ? Un groupe partagé crée un espace neutre, consultable par chacun sans passer par l'autre, et le flux .ics permet à chacun de garder son propre agenda.",
        ],
      },
    ],
    faq: [
      {
        question: "Comment partager les rendez-vous médicaux des enfants entre parents ?",
        answer:
          "Créez un calendrier commun au foyer et ajoutez-y chaque rendez-vous au moment où il est pris. Dans MindDump, un rendez-vous rattaché au groupe est visible par tous ses membres, et son rappel e-mail part à chacun d'eux.",
      },
      {
        question: "Faut-il re-saisir les rendez-vous déjà dans mon agenda ?",
        answer:
          "Non. MindDump s'abonne aux calendriers externes au format iCal (Google, Apple, école, club) et affiche leurs dates pour tout le foyer. Dans l'autre sens, le calendrier du foyer s'exporte en .ics vers ton agenda habituel.",
      },
      {
        question: "MindDump prend-il les rendez-vous chez le médecin ?",
        answer:
          "Non. Le rendez-vous se prend comme d'habitude, sur la plateforme du praticien ou par téléphone. MindDump sert à ce que le foyer entier le connaisse et soit prévenu à temps.",
      },
      {
        question: "Peut-on stocker les ordonnances ou les documents dans MindDump ?",
        answer:
          "Non, MindDump ne stocke aucun document. Tu peux noter dans la description du rendez-vous ce qu'il faut apporter, mais les papiers restent là où tu les ranges aujourd'hui.",
      },
    ],
    related: ["echeances-administratives-famille", "calendrier-familial-partage", "charge-mentale"],
  },
  {
    slug: "echeances-administratives-famille",
    metaTitle: "Échéances administratives du foyer : ce qui s'oublie une fois par an",
    metaDescription:
      "Assurance, contrôle technique, vaccins, impôts, papiers d'identité : l'inventaire des échéances annuelles d'une famille, et comment ne plus les porter de tête.",
    eyebrow: "Guide pratique",
    navLabel: "Échéances du foyer",
    title: "Les échéances du foyer : ce qui s'oublie une fois par an",
    intro:
      "Ce qui revient chaque semaine finit par devenir une habitude. Ce qui revient une fois par an ne devient jamais une habitude : on l'a oublié depuis la dernière fois. Assurance, contrôle technique, rappel de vaccin, déclaration de revenus — c'est justement parce qu'elles sont rares que ces échéances pèsent.",
    sections: [
      {
        heading: "Pourquoi les échéances annuelles échappent à la mémoire",
        paragraphs: [
          "La mémoire d'un foyer fonctionne très bien sur la semaine et très mal sur l'année. Entre deux occurrences, rien ne rappelle l'échéance : pas de routine, pas de courrier fiable, pas de collègue qui en parle.",
          "Résultat, elles reposent sur une seule personne, souvent celle qui s'en est occupée l'année précédente — et qui garde, douze mois durant, un pense-bête qui ne se voit pas.",
        ],
      },
      {
        heading: "L'inventaire annuel d'une famille",
        paragraphs: [
          "Toutes ne concernent pas chaque foyer, mais la liste est plus longue qu'on ne le croit. Les dates exactes dépendent de chaque situation : vérifie-les sur tes propres contrats et sur les sites officiels.",
        ],
        bullets: [
          {
            title: "Les contrats",
            body: "Assurance habitation, assurance auto, mutuelle, abonnements d'énergie ou de box : chacun a sa date anniversaire, souvent le seul moment pour renégocier ou résilier.",
          },
          {
            title: "Le véhicule",
            body: "Le contrôle technique revient tous les deux ans pour une voiture particulière, après le premier à quatre ans. L'entretien et les pneus hiver suivent leur propre calendrier.",
          },
          {
            title: "La santé",
            body: "Les rappels de vaccins suivent le calendrier vaccinal (ameli.fr le détaille par âge), sans oublier ceux des animaux. Les rendez-vous de suivi annuels — dentiste, ophtalmologiste — entrent dans la même catégorie.",
          },
          {
            title: "Les impôts",
            body: "La déclaration de revenus au printemps, puis les avis de taxe foncière et les éventuels acomptes. Les dates changent chaque année : note-les dès qu'elles sont publiées.",
          },
          {
            title: "L'école et les activités",
            body: "Inscriptions scolaires, cantine, périscolaire, centre de loisirs, clubs de sport : la plupart se jouent entre le printemps et la rentrée, avec des places limitées.",
          },
          {
            title: "Les papiers d'identité",
            body: "Carte d'identité et passeport ont une durée de validité. Les délais de rendez-vous en mairie s'allongent avant l'été : mieux vaut vérifier les dates d'expiration dès l'hiver.",
          },
        ],
      },
      {
        heading: "Noter une fois, être prévenu chaque année",
        paragraphs: [
          "Une échéance annuelle se note une seule fois. Dans MindDump, une tâche planifiée ou un événement du calendrier peut se répéter chaque année : la date revient d'elle-même, sans rien re-saisir.",
          "Le rappel part par e-mail au délai que tu choisis — un mois avant pour une assurance à renégocier, une semaine pour un vaccin. Et si l'échéance est rattachée au foyer, chaque membre reçoit le rappel : ce n'est plus la seule personne qui s'en souvenait qui porte l'alerte.",
        ],
        bullets: [
          {
            title: "Une tâche annuelle",
            body: "Pour ce qu'il faut faire : renégocier l'assurance, déclarer ses revenus. Une fois cochée, elle se recrée pour l'année suivante.",
          },
          {
            title: "Un événement annuel",
            body: "Pour ce qui tombe à une date : la date anniversaire d'un contrat, le rappel de vaccin. Il apparaît chaque année dans le calendrier du foyer, avec son rappel.",
          },
          {
            title: "Dicté plutôt que saisi",
            body: "Avec l'assistant IA connecté à MindDump : « rappelle-nous chaque année, un mois avant le 15 mars, de renégocier l'assurance habitation ».",
          },
        ],
      },
      {
        heading: "Par où commencer",
        paragraphs: [
          "Prends un quart d'heure avec les relevés bancaires de l'année : chaque prélèvement annuel est une échéance. Note les dates anniversaires, règle le rappel un mois avant, et rattache-les au foyer. L'année prochaine, c'est l'app qui s'en souviendra.",
        ],
      },
    ],
    faq: [
      {
        question: "Comment ne pas oublier les échéances administratives annuelles ?",
        answer:
          "En les notant une seule fois avec une répétition annuelle et un rappel en avance. Dans MindDump, une tâche ou un événement annuel revient chaque année et envoie un e-mail au délai choisi, à toi et aux membres du foyer.",
      },
      {
        question: "Quelles sont les principales échéances annuelles d'une famille ?",
        answer:
          "Les dates anniversaires des contrats (assurances, mutuelle, énergie), le contrôle technique, les rappels de vaccins, la déclaration de revenus, les inscriptions scolaires et périscolaires, et la validité des papiers d'identité.",
      },
      {
        question: "Les membres de la famille reçoivent-ils aussi le rappel ?",
        answer:
          "Oui, si l'échéance est rattachée au foyer : le rappel e-mail part à chacun des membres du groupe, pas seulement à la personne qui l'a créée.",
      },
    ],
    related: ["rendez-vous-famille", "charge-mentale", "calendrier-familial-partage"],
  },
];

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((g) => g.slug === slug);
  // Les slugs viennent des dossiers de routes, jamais de l'URL : une absence
  // est une erreur de développement, pas une 404.
  if (!guide) throw new Error(`Guide inconnu : ${slug}`);
  return guide;
}
