import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_VERSION } from "@/lib/consent";
import { getPrivacyInfo } from "@/lib/privacy";

// Lue à chaque requête : l'identité de l'éditeur vient de variables
// d'environnement (voir src/lib/privacy.ts), pas du build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Quelles données MindDump collecte, pourquoi, combien de temps, avec qui elles sont partagées et comment exercer tes droits.",
  alternates: { canonical: "/confidentialite" },
  // Page publique et accessible à tous, mais tenue hors des moteurs de
  // recherche : l'adresse de contact y est affichée en clair.
  robots: { index: false, follow: true },
};

// Affiche une adresse e-mail en lien cliquable, un texte « à compléter » tel quel.
function Contact({ email }: { email: string }) {
  if (!email.includes("@")) return <span className="text-foreground">{email}</span>;
  return (
    <a href={`mailto:${email}`} className="text-primary hover:underline">
      {email}
    </a>
  );
}

// Texte de départ à relire. Toute modification substantielle doit
// s'accompagner d'une nouvelle CONSENT_VERSION (src/lib/consent.ts).
const UPDATED_AT = "22 septembre 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-2 pr-4 text-left font-medium text-foreground whitespace-nowrap">
        {label}
      </th>
      <td className="py-2">{children}</td>
    </tr>
  );
}

export default function PrivacyPolicyPage() {
  const { controller, contactEmail, mailProvider } = getPrivacyInfo();

  return (
    <article className="max-w-3xl mx-auto space-y-10 py-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← MindDump
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground">
          Mise à jour le {UPDATED_AT} · version {CONSENT_VERSION}
        </p>
      </header>

      <Section title="En bref">
        <ul className="list-disc pl-5 space-y-1">
          <li>MindDump garde ce que tu y ranges pour te le restituer et le partager avec les groupes que tu choisis.</li>
          <li>Aucune publicité, aucune revente, aucun traceur de mesure d&apos;audience.</li>
          <li>Tes données sont hébergées dans l&apos;Union européenne (Allemagne).</li>
          <li>
            Tu peux les exporter ou supprimer ton compte à tout moment depuis ton{" "}
            <Link href="/profile" className="text-primary hover:underline">profil</Link>.
          </li>
        </ul>
      </Section>

      <Section title="Qui est responsable de tes données ?">
        <p>
          Le responsable du traitement est {controller}. L&apos;application est hébergée par Hetzner
          Online GmbH (Allemagne). Pour toute question sur tes données :{" "}
          <Contact email={contactEmail} />.
        </p>
      </Section>

      <Section title="Les données collectées">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Compte">
                Prénom, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée,
                irréversible), identifiant public, date de création du compte. Si tu te connectes avec
                Google : ton nom, ton e-mail et ta photo de profil Google, ainsi que les jetons de
                connexion fournis par Google.
              </Row>
              <Row label="Contenus">
                Ce que tu crées : todos, événements et rappels, abonnements à des calendriers externes
                (adresse du calendrier), listes de courses, recettes et leurs photos, groupes et
                invitations (dont l&apos;e-mail de la personne invitée, si tu l&apos;indiques).
              </Row>
              <Row label="Semainier">
                Si tu utilises le semainier enfant : les informations que tu notes sur la journée
                d&apos;un enfant (météo, humeur, sieste, « accidents », activités). Ne saisis que ce qui
                est utile au suivi familial.
              </Row>
              <Row label="Localisation">
                Seulement si tu règles la météo : la ville choisie et ses coordonnées, ou ta position
                si tu autorises le navigateur à la partager.
              </Row>
              <Row label="Connexions">
                Date et mode (e-mail ou Google) de chaque connexion, et date de la dernière connexion.
              </Row>
              <Row label="Consentement">
                Date à laquelle tu as accepté cette politique et version du texte accepté.
              </Row>
              <Row label="Intégrations">
                Les clés API que tu crées pour connecter un assistant IA (nom et date de création).
              </Row>
            </tbody>
          </table>
        </div>
        <p>
          MindDump ne collecte pas de données de navigation, ne dépose pas de cookie publicitaire et
          n&apos;utilise pas d&apos;outil de mesure d&apos;audience.
        </p>
      </Section>

      <Section title="Pourquoi, et sur quelle base légale">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Faire fonctionner le service</strong> (ton compte, tes
            contenus, le partage en groupe, les rappels par e-mail, la météo) : exécution du service
            que tu utilises (article 6.1.b du RGPD).
          </li>
          <li>
            <strong className="text-foreground">Sécuriser le service et suivre son usage</strong>{" "}
            (historique de connexion, statistiques internes agrégées : nombre de comptes, de recettes,
            volume de stockage) : intérêt légitime de l&apos;éditeur à maintenir un service fiable
            (article 6.1.f). Ces statistiques ne sont consultées que par l&apos;administrateur et ne
            sont jamais transmises à des tiers.
          </li>
          <li>
            <strong className="text-foreground">Ta position</strong> : uniquement si tu l&apos;autorises
            dans ton navigateur, autorisation que tu peux retirer à tout moment.
          </li>
        </ul>
      </Section>

      <Section title="Combien de temps">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Compte et contenus : tant que ton compte existe. Ils sont supprimés dès que tu supprimes
            ton compte.
          </li>
          <li>Historique de connexion : 12 mois, puis supprimé automatiquement.</li>
          <li>
            Sauvegardes de la base : une sauvegarde hebdomadaire conservée sur le serveur, et des
            sauvegardes techniques créées avant chaque mise à jour (les 3 dernières, puis une par
            semaine pendant 3 mois).
          </li>
        </ul>
      </Section>

      <Section title="Qui y a accès">
        <p>
          <strong className="text-foreground">Les membres de tes groupes</strong> voient les éléments
          que tu partages avec ce groupe. <strong className="text-foreground">Les personnes à qui tu
          envoies un lien de partage</strong> de recette voient cette recette.
        </p>
        <p>Prestataires techniques, qui n&apos;utilisent les données que pour rendre le service :</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Hetzner Online GmbH (Allemagne) : hébergement de l&apos;application, de la base et des photos.</li>
          <li>
            {mailProvider} : envoi des rappels (ton e-mail et le titre du rappel).
          </li>
          <li>Google (États-Unis) : uniquement si tu choisis « Se connecter avec Google ».</li>
          <li>
            Open-Meteo (Suisse) et OpenStreetMap Nominatim (Royaume-Uni) : les coordonnées de la
            ville choisie pour la météo, sans ton nom ni ton e-mail.
          </li>
          <li>
            Sites de recettes (HelloFresh, Jow, Quitoque) : les photos des recettes importées sont
            affichées depuis leurs serveurs, qui voient donc ton adresse IP.
          </li>
        </ul>
        <p>
          Si tu connectes un assistant IA avec une clé API, cet assistant accède à tes données à ta
          demande et selon ses propres conditions. Tu peux révoquer la clé depuis ton profil.
        </p>
        <p>
          Les transferts hors de l&apos;Union européenne se font vers des pays reconnus comme
          offrant une protection adéquate (Suisse, Royaume-Uni) ou, pour Google, dans le cadre du
          Data Privacy Framework UE–États-Unis.
        </p>
      </Section>

      <Section title="Cookies et stockage dans ton navigateur">
        <p>
          MindDump n&apos;utilise que des traceurs strictement nécessaires au service ou mémorisant
          tes préférences d&apos;affichage. Ils sont exemptés de consentement (article 82 de la loi
          Informatique et Libertés), c&apos;est pourquoi il n&apos;y a pas de bandeau cookies.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Cookies de session">
                <code>next-auth.session-token</code>, <code>next-auth.csrf-token</code>,{" "}
                <code>next-auth.callback-url</code> (préfixés <code>__Secure-</code> /{" "}
                <code>__Host-</code> en HTTPS) : te garder connecté et protéger les formulaires.
              </Row>
              <Row label="Stockage local">
                <code>theme</code> (clair ou sombre), <code>sidebarCollapsed</code> (menu replié),{" "}
                <code>currentGroupId</code> (groupe actif), <code>nextauth.message</code>
                (synchronise la connexion et la déconnexion entre onglets). Restent sur ton appareil,
                ne sont pas envoyés au serveur.
              </Row>
            </tbody>
          </table>
        </div>
        <p>Les polices de caractères sont servies par MindDump, sans appel à un service tiers.</p>
      </Section>

      <Section title="Tes droits">
        <p>
          Tu disposes d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          portabilité, de limitation et d&apos;opposition sur tes données.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Accès et portabilité</strong> : « Exporter mes
            données » dans ton <Link href="/profile" className="text-primary hover:underline">profil</Link>{" "}
            télécharge l&apos;ensemble de tes données au format JSON.
          </li>
          <li>
            <strong className="text-foreground">Effacement</strong> : « Supprimer mon compte » dans ton
            profil supprime immédiatement et définitivement ton compte et tes contenus personnels.
            Pour ce que tu as ajouté dans un groupe partagé qui continue d&apos;exister, tu choisis :
            le laisser aux autres membres (il passe alors au propriétaire du groupe) ou le
            supprimer.
          </li>
          <li>
            <strong className="text-foreground">Rectification</strong> : tes contenus sont modifiables
            dans l&apos;application ; pour le reste, écris-nous.
          </li>
        </ul>
        <p>
          Pour toute autre demande : <Contact email={contactEmail} />. Nous répondons sous
          un mois. Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL
          (cnil.fr).
        </p>
      </Section>
    </article>
  );
}
