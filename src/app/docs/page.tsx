"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Bot, Calendar, MapPin, ArrowLeft, KeyRound, Rss, Link2, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

function McpPrompt() {
  const [appUrl, setAppUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const url = appUrl.trim() || "<URL de mon app MindDump>";
    const key = apiKey.trim() || "<ma clé API MindDump>";
    return `Connecte-toi à mon app MindDump via MCP, pour que je puisse te demander de gérer mes tâches, mes courses et mes recettes en te parlant directement.

Configure une entrée "minddump" dans ma config MCP (le fichier de config Claude Desktop, ou .mcp.json si tu es dans le projet MindDump) qui lance le serveur du dossier minddump-mcp/ (commande "npx tsx src/index.ts") avec ces variables d'environnement :
MINDDUMP_API_URL=${url}
MINDDUMP_API_KEY=${key}

Si tu n'as pas accès aux fichiers de ce projet (par exemple sur mobile ou le web), connecte-toi plutôt en mode distant : ajoute un serveur MCP de type "sse" à la place, avec l'URL et le secret que je te donnerai.

Crée le fichier de config s'il n'existe pas, redémarre-toi si besoin, puis confirme que la connexion fonctionne.`;
  }, [appUrl, apiKey]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>URL de ton app MindDump</Label>
          <Input
            placeholder="https://mon-minddump.example"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ta clé API</Label>
          <Input
            placeholder="mdk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>
      <div className="relative">
        <pre className="bg-secondary/50 border border-border rounded-lg p-3 pr-12 text-xs whitespace-pre-wrap">
          {prompt}
        </pre>
        <Button
          size="sm"
          variant={copied ? "default" : "outline"}
          onClick={copyPrompt}
          className="absolute top-2 right-2 h-7 px-2"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Remplis les deux champs (facultatif), copie le prompt, colle-le dans une conversation
        Claude (Desktop, Code, ou l&apos;app mobile) — il s&apos;occupe du reste.
      </p>
    </div>
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
          la lasagne »… Pas besoin de toucher à un fichier de config toi-même : demande à Claude
          de le faire.
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
          <p className="font-medium">2. Copier le prompt et le donner à Claude</p>
          <McpPrompt />
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
