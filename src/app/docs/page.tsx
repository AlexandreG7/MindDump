import Link from "next/link";
import { Bot, Calendar, MapPin, ArrowLeft, KeyRound, Rss, Link2 } from "lucide-react";

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-secondary/50 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-card border border-border rounded-2xl p-6 space-y-4 scroll-mt-6">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-foreground/90">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <Link
          href="/profile"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au profil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connecter Claude, synchroniser tes calendriers, et régler la météo.
        </p>
      </div>

      {/* ── Assistant IA (MCP) ──────────────────────────────────── */}
      <Section id="assistant-ia" icon={Bot} title="Assistant IA (MCP)">
        <p className="text-muted-foreground">
          MindDump peut être piloté en langage naturel depuis Claude : « ajoute du lait à ma
          liste de courses », « montre mes tâches urgentes », « crée une liste de courses pour
          la lasagne »… Deux façons de le connecter.
        </p>

        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            1. Créer une clé API
          </p>
          <p className="text-muted-foreground">
            Dans <Link href="/profile" className="text-primary hover:underline">Profil → Clés API</Link>,
            clique sur « Nouvelle clé » et copie-la — elle ne sera plus affichée en entier
            ensuite.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-medium">2a. Claude Desktop (installation locale)</p>
          <p className="text-muted-foreground">
            Ajoute dans <code className="text-xs bg-secondary/50 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> :
          </p>
          <Code>{`{
  "mcpServers": {
    "minddump": {
      "command": "npx",
      "args": ["tsx", "/chemin/absolu/vers/minddump-mcp/src/index.ts"],
      "env": {
        "MINDDUMP_API_URL": "https://ton-domaine.example",
        "MINDDUMP_API_KEY": "mdk_ta-cle-ici"
      }
    }
  }
}`}</Code>
          <p className="text-muted-foreground">Puis redémarre Claude Desktop.</p>
        </div>

        <div className="space-y-2">
          <p className="font-medium">2b. Claude Code (dans ce projet)</p>
          <p className="text-muted-foreground">
            Le même bloc va dans <code className="text-xs bg-secondary/50 px-1 py-0.5 rounded">.mcp.json</code> à
            la racine du dépôt, avec <code className="text-xs bg-secondary/50 px-1 py-0.5 rounded">args: [&quot;tsx&quot;, &quot;./minddump-mcp/src/index.ts&quot;]</code>.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-medium">2c. Accès distant (Claude mobile / web)</p>
          <p className="text-muted-foreground">
            Le serveur MCP tourne aussi en mode SSE, accessible depuis n&apos;importe où sans
            installation locale :
          </p>
          <Code>{`{
  "mcpServers": {
    "minddump": {
      "type": "sse",
      "url": "https://<url-du-serveur-mcp>/sse",
      "headers": { "Authorization": "Bearer <MCP_SECRET>" }
    }
  }
}`}</Code>
          <p className="text-muted-foreground">
            Ce mode utilise un secret partagé côté serveur (variable{" "}
            <code className="text-xs bg-secondary/50 px-1 py-0.5 rounded">MCP_SECRET</code>) et
            agit avec la clé API configurée sur le serveur — demande le secret à la personne qui
            héberge l&apos;instance si tu ne l&apos;as pas déployée toi-même.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="font-medium">Outils disponibles</p>
          <p className="text-muted-foreground">
            Recettes (créer, lister, convertir en liste de courses), tâches (créer, lister,
            compléter, modifier), listes de courses, groupes.
          </p>
        </div>
      </Section>

      {/* ── Calendrier ──────────────────────────────────────────── */}
      <Section id="calendrier" icon={Calendar} title="Calendrier">
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            Importer un calendrier externe
          </p>
          <p className="text-muted-foreground">
            Dans <Link href="/calendar" className="text-primary hover:underline">Calendrier</Link>,
            clique sur l&apos;icône <Link2 className="h-3.5 w-3.5 inline" /> puis colle une URL{" "}
            <code className="text-xs bg-secondary/50 px-1 py-0.5 rounded">webcal://</code>.
          </p>
          <ul className="text-muted-foreground list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium text-foreground">Apple Calendar</span> : clic droit sur
              un calendrier → Partager le calendrier → Calendrier public → copie l&apos;URL.
            </li>
            <li>
              <span className="font-medium text-foreground">Google Calendar</span> : Réglages du
              calendrier → « Intégrer le calendrier » → adresse secrète au format iCal.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <Rss className="h-3.5 w-3.5 text-muted-foreground" />
            Exporter le calendrier MindDump
          </p>
          <p className="text-muted-foreground">
            Toujours dans Calendrier, l&apos;icône <Rss className="h-3.5 w-3.5 inline" /> génère
            un lien unique qui expose tes événements MindDump en lecture seule. Colle-le dans
            Apple Calendar, Google Calendar ou Outlook — il se met à jour automatiquement. Tu
            peux le régénérer ou le révoquer à tout moment ; l&apos;ancien lien cesse alors de
            fonctionner.
          </p>
        </div>
      </Section>

      {/* ── Météo ───────────────────────────────────────────────── */}
      <Section id="meteo" icon={MapPin} title="Météo">
        <p className="text-muted-foreground">
          Par défaut, le dashboard demande ta position au navigateur à chaque visite. Dans{" "}
          <Link href="/profile" className="text-primary hover:underline">Profil → Météo</Link>,
          tu peux fixer une ville une fois pour toutes (recherche par nom, ou « utiliser ma
          position actuelle ») — la météo s&apos;affichera directement, sans demande de
          permission.
        </p>
      </Section>
    </div>
  );
}
