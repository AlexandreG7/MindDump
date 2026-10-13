import type { Metadata } from "next";
import Link from "next/link";
import { getPrivacyInfo } from "@/lib/privacy";

// Lue à chaque requête : l'identité de l'éditeur vient de variables
// d'environnement (voir src/lib/privacy.ts), pas du build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Les règles d'usage de la bêta privée de MindDump : accès sur invitation, compte, contenus, foyer, assistant IA, données de santé interdites.",
  // Comme /confidentialite : publique, mais tenue hors des moteurs de recherche
  // (l'adresse de contact y est affichée en clair).
  robots: { index: false, follow: true },
};

// Texte de départ à relire. Les comptes existants n'ont pas à le ré-accepter :
// ne pas toucher à CONSENT_VERSION (src/lib/consent.ts) pour ce texte.
const UPDATED_AT = "13 octobre 2026";

function Contact({ email }: { email: string }) {
  if (!email.includes("@")) return <span className="text-foreground">{email}</span>;
  return (
    <a href={`mailto:${email}`} className="text-primary hover:underline">
      {email}
    </a>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const { controller, contactEmail } = getPrivacyInfo();

  return (
    <article className="max-w-3xl mx-auto space-y-10 py-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← MindDump
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Conditions d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground">Mise à jour le {UPDATED_AT}</p>
      </header>

      <Section title="En bref">
        <ul className="list-disc pl-5 space-y-1">
          <li>MindDump est une bêta privée, gratuite pour l&apos;instant, éditée par un particulier.</li>
          <li>L&apos;accès se fait sur invitation, avec un compte personnel que tu protèges.</li>
          <li>Ce que tu ranges dans MindDump reste à toi, et ce que tu partages au foyer est visible de ses membres.</li>
          <li>
            <strong className="text-foreground">N&apos;y saisis aucune donnée de santé</strong>, ni la tienne ni celle
            d&apos;un tiers, enfant compris.
          </li>
          <li>Le service est fourni tel quel, sans garantie, et peut changer ou s&apos;arrêter.</li>
        </ul>
      </Section>

      <Section title="1. Objet">
        <p>
          Ces conditions encadrent l&apos;usage de MindDump, une application web qui aide un foyer à vider sa
          charge mentale : tâches, listes de courses, recettes et menus, calendrier, rendez-vous, échéances
          et semainier des enfants. Elles s&apos;appliquent dès que tu crées un compte ou utilises le service.
          L&apos;éditeur est {controller}. La manière dont tes données sont traitées est décrite dans la{" "}
          <Link href="/confidentialite" className="text-primary hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </Section>

      <Section title="2. Accès sur invitation">
        <p>
          MindDump est en bêta privée : on y entre sur demande d&apos;accès, acceptée par l&apos;éditeur, qui
          t&apos;envoie un lien d&apos;invitation personnel. Ce lien est à toi : ne le transmets pas. L&apos;éditeur
          peut refuser ou retirer un accès, notamment en cas d&apos;usage contraire à ces conditions.
        </p>
      </Section>

      <Section title="3. Compte et sécurité">
        <ul className="list-disc pl-5 space-y-2">
          <li>Les informations de ton compte doivent être exactes et tenues à jour. Un compte est personnel.</li>
          <li>
            Tu gardes confidentiels ton mot de passe, tes appareils connectés et tes clés API. Une action faite
            avec ton compte est réputée faite par toi : si tu soupçonnes un accès non autorisé, change ton mot de
            passe, révoque tes clés depuis ton profil et préviens l&apos;éditeur.
          </li>
          <li>
            Tu n&apos;essaies pas de contourner les protections du service, d&apos;accéder aux données d&apos;autrui
            ou de le surcharger.
          </li>
        </ul>
      </Section>

      <Section title="4. Tes contenus et ta responsabilité">
        <p>
          Les contenus que tu ranges (tâches, listes, recettes, événements, notes…) restent les tiens.
          Tu donnes à MindDump le droit de les stocker et de les afficher, à toi et aux personnes avec qui tu
          les partages, pour faire fonctionner le service, et à cela seulement.
        </p>
        <p>
          Tu es responsable de ce que tu y mets : tu n&apos;y déposes rien d&apos;illégal, de diffamatoire ou
          qui porte atteinte aux droits d&apos;autrui, et tu n&apos;y saisis des informations sur une autre personne
          que si tu as le droit de le faire.
        </p>
      </Section>

      <Section id="donnees-de-sante" title="5. Données de santé interdites">
        <p>
          <strong className="text-foreground">
            Tu ne dois saisir aucune donnée de santé dans MindDump
          </strong>
          , que ce soit la tienne ou celle d&apos;une autre personne, enfant compris. Cela vaut pour tous les
          champs de texte et pour les rubriques personnalisées du semainier. Par exemple : diagnostic,
          traitement, médicament, symptôme, handicap, examen, état de santé physique ou mentale, sommeil ou
          incontinence suivis comme des éléments médicaux.
        </p>
        <p>
          Le semainier fournit des images neutres, sans signification propre. Le sens d&apos;une rubrique est
          défini par toi, pas par MindDump, et c&apos;est à toi de ne pas en faire un suivi de santé.
          MindDump n&apos;est pas conçu, ni hébergé ni sécurisé pour recevoir ce type de données, et
          n&apos;est pas un dispositif médical.
        </p>
        <p>
          Si tu as saisi une telle donnée par erreur, supprime-la ou demande-nous de le faire. L&apos;éditeur peut
          supprimer un contenu qui en contient.
        </p>
      </Section>

      <Section title="6. Foyer et partage">
        <p>
          Tu peux rejoindre ou créer un groupe (ton foyer, par exemple). Tout ce que tu partages dans un groupe
          est visible par ses membres, et les profils d&apos;enfants ainsi que leur semainier sont visibles de
          tous les membres du groupe. Vérifie qui en fait partie avant de partager. Un élément personnel, non
          partagé, reste visible de toi seul. Les écrans muraux affichent les éléments du groupe à toute personne
          qui a leur lien secret.
        </p>
        <p>
          Si tu supprimes ton compte, tu choisis, pour ce que tu as ajouté dans un groupe qui continue
          d&apos;exister, de le laisser aux autres membres ou de le supprimer.
        </p>
      </Section>

      <Section title="7. Assistant IA et serveur MCP">
        <p>
          MindDump propose un serveur MCP qui permet à un assistant IA d&apos;agir sur tes données avec une clé
          API que tu crées. C&apos;est toi qui branches ton client (Claude, ChatGPT ou autre) : l&apos;assistant
          accède alors à ce que ton compte peut voir et modifier, selon ses propres conditions, que MindDump ne
          contrôle pas. Une réponse d&apos;un assistant peut être inexacte : vérifie avant de t&apos;y fier.
          Tu peux révoquer la clé à tout moment depuis ton profil. L&apos;interdiction de saisir des données de santé
          s&apos;applique aussi à ce que ton assistant écrit dans MindDump.
        </p>
      </Section>

      <Section title="8. Disponibilité : bêta, sans garantie">
        <p>
          MindDump est une bêta : le service est fourni tel quel, sans garantie de disponibilité,
          d&apos;absence d&apos;erreur ou de conservation. Il peut être interrompu, modifié, ou arrêté, et des
          données peuvent être perdues malgré les sauvegardes. N&apos;y range rien dont tu ne pourrais te passer :
          garde ailleurs une copie de ce qui est important (tu peux exporter tes données depuis ton{" "}
          <Link href="/profile" className="text-primary hover:underline">profil</Link>).
          Le service est gratuit à ce jour ; l&apos;éditeur ne s&apos;engage pas à ce qu&apos;il le reste et te
          préviendrait avant tout changement de modèle.
        </p>
        <p>
          Dans la mesure permise par la loi, l&apos;éditeur n&apos;est pas responsable des dommages indirects
          liés à l&apos;usage ou à l&apos;indisponibilité du service. Cela ne limite pas les droits que la loi
          t&apos;accorde en tant que consommateur.
        </p>
      </Section>

      <Section title="9. Suppression du compte">
        <p>
          Tu peux supprimer ton compte à tout moment depuis ton{" "}
          <Link href="/profile" className="text-primary hover:underline">profil</Link> : la suppression est
          immédiate et définitive, comme décrit dans la politique de confidentialité. L&apos;éditeur peut
          aussi fermer un compte qui enfreint ces conditions ou arrêter la bêta ; il t&apos;en informe si
          possible et te laisse exporter tes données.
        </p>
      </Section>

      <Section title="10. Modifications des conditions">
        <p>
          Ces conditions peuvent évoluer avec la bêta. La date de mise à jour figure en haut de la page. En cas de
          changement important, nous te prévenons dans l&apos;application ou par e-mail. Continuer à utiliser
          MindDump après la mise à jour vaut acceptation du nouveau texte ; sinon, tu peux supprimer ton compte.
        </p>
      </Section>

      <Section title="11. Droit applicable">
        <p>
          Ces conditions sont régies par le droit français. En cas de litige, nous cherchons d&apos;abord une
          solution amiable. À défaut, les tribunaux français sont compétents, sans priver un consommateur
          des règles de compétence qui le protègent.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Pour toute question sur ces conditions ou pour signaler un contenu : <Contact email={contactEmail} />.
        </p>
      </Section>
    </article>
  );
}
