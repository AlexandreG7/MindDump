"use client";

import {
  Users,
  UsersRound,
  ChefHat,
  CheckSquare,
  ShoppingCart,
  Bot,
  Database,
  HardDrive,
  TrendingUp,
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminOverview, AdminStorage, AdminUsersPage } from "@/lib/adminStats";
import { DailyBarChart } from "./DailyBarChart";
import { UsersTable } from "./UsersTable";
import { formatBytes, formatDate, formatNumber, formatPercent } from "./format";

function Panel({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-base font-semibold">{title}</h2>
        {badge && (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  );
}

const sum = (points: { count: number }[]) => points.reduce((s, p) => s + p.count, 0);

export function AdminDashboard({
  overview,
  storage,
  initialUsers,
}: {
  overview: AdminOverview;
  storage: AdminStorage;
  initialUsers: AdminUsersPage;
}) {
  const { totals, ai } = overview;
  const tableMax = Math.max(1, ...storage.database.tables.map((t) => t.bytes));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Données du {formatDate(overview.generatedAt, true)} · actualisées au plus toutes les 60 s
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="storage">Stockage</TabsTrigger>
        </TabsList>

        {/* ── Vue d'ensemble ─────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatTile label="Utilisateurs" value={totals.users} icon={Users} />
            <StatTile label="Groupes" value={totals.groups} icon={UsersRound} />
            <StatTile label="Recettes" value={totals.recipes} icon={ChefHat} />
            <StatTile label="Todos" value={totals.todos} icon={CheckSquare} />
            <StatTile label="Listes de courses" value={totals.shoppingLists} icon={ShoppingCart} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Assistant IA branché" icon={Bot}>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tabular-nums">{formatNumber(ai.usersWithApiKey)}</p>
                <p className="text-sm text-muted-foreground">
                  compte{ai.usersWithApiKey > 1 ? "s" : ""} sur {formatNumber(totals.users)} ·{" "}
                  <span className="font-medium text-foreground">{formatPercent(ai.ratio)}</span>
                </p>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${ai.ratio * 100}%` }} />
              </div>
              <Note>
                Comptes ayant au moins une clé API (MCP, préfixe mdk_) · {formatNumber(ai.apiKeys)} clé
                {ai.apiKeys > 1 ? "s" : ""} au total. Les valeurs des clés ne sont jamais affichées.
              </Note>
            </Panel>

            <Panel title="Utilisateurs actifs" icon={Users} badge="30 jours">
              <p className="text-3xl font-semibold tabular-nums">{formatNumber(overview.activeUsers30d)}</p>
              <Note>Comptes connectés au moins une fois ces 30 derniers jours.</Note>
            </Panel>
          </div>

          <Panel title="Connexions par jour" badge={`${formatNumber(sum(overview.logins))} sur 30 j`}>
            <DailyBarChart data={overview.logins} unit="connexion(s)" />
            <Note>
              Historique disponible depuis{" "}
              {overview.loginHistoryStart
                ? `le ${formatDate(overview.loginHistoryStart, true)}`
                : "le déploiement du suivi des connexions (aucune connexion enregistrée pour l'instant)"}
              . Les connexions antérieures n&apos;ont pas été enregistrées et ne peuvent pas être
              reconstituées.
            </Note>
          </Panel>

          <Panel title="Recettes ajoutées par jour" badge={`${formatNumber(sum(overview.recipesPerDay))} sur 30 j`}>
            <DailyBarChart data={overview.recipesPerDay} unit="recette(s)" />
          </Panel>
        </TabsContent>

        {/* ── Utilisateurs ──────────────────────────────────── */}
        <TabsContent value="users">
          <UsersTable initial={initialUsers} />
        </TabsContent>

        {/* ── Stockage ───────────────────────────────────────── */}
        <TabsContent value="storage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Base PostgreSQL" icon={Database} badge="Mesure réelle">
              <p className="text-3xl font-semibold tabular-nums">{formatBytes(storage.database.totalBytes)}</p>
              <div className="space-y-1.5">
                {storage.database.tables.map((t) => (
                  <div key={t.name} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-xs">
                    <span className="truncate font-mono text-muted-foreground">{t.name}</span>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(t.bytes / tableMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums">{formatBytes(t.bytes)}</span>
                  </div>
                ))}
              </div>
              <Note>
                pg_database_size et pg_total_relation_size (données + index + TOAST). Le total inclut
                les catalogues système de PostgreSQL.
              </Note>
            </Panel>

            <Panel title="Fichiers uploadés" icon={HardDrive} badge="Mesure réelle">
              <p className="text-3xl font-semibold tabular-nums">{formatBytes(storage.uploads.bytes)}</p>
              <p className="text-sm text-muted-foreground">
                {formatNumber(storage.uploads.files)} fichier{storage.uploads.files > 1 ? "s" : ""} · moyenne{" "}
                {formatBytes(storage.uploads.avgFileBytes)} par fichier
              </p>
              <div className="space-y-1 text-xs">
                {storage.uploads.dirs.map((d) => (
                  <div key={d.dir} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-muted-foreground">{d.dir}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      {formatBytes(d.bytes)} · {formatNumber(d.files)}
                    </span>
                  </div>
                ))}
              </div>
              <Note>Somme des tailles des fichiers sur disque (photos de recettes).</Note>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Poids moyen par élément" icon={Database} badge="Calcul">
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Recette", value: storage.database.averages.recipe, hint: "+ ingrédients" },
                  { label: "Todo", value: storage.database.averages.todo, hint: "" },
                  { label: "Liste", value: storage.database.averages.shoppingList, hint: "+ articles" },
                ].map((a) => (
                  <div key={a.label} className="rounded-xl bg-secondary/40 p-3">
                    <dt className="text-xs text-muted-foreground">{a.label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatBytes(a.value)}</dd>
                    {a.hint && <dd className="text-[11px] text-muted-foreground">{a.hint}</dd>}
                  </div>
                ))}
              </dl>
              <Note>
                Taille de la table (index compris) ÷ nombre de lignes. Sur de petits volumes, les
                pages minimales de 8 Ko et les index gonflent fortement cette moyenne.
              </Note>
            </Panel>

            <Panel title="Projection" icon={TrendingUp} badge="Estimation">
              <p className="text-sm">
                Au rythme actuel de{" "}
                <strong>
                  {storage.projection.recipesPerDay.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}{" "}
                  recette{storage.projection.recipesPerDay >= 2 ? "s" : ""}/jour
                </strong>{" "}
                (moyenne des 30 derniers jours) :
              </p>
              <ul className="text-sm space-y-1">
                <li>
                  Base : <strong>+{formatBytes(storage.projection.dbGrowthPerMonth)}/mois</strong>
                </li>
                <li>
                  Photos : <strong>+{formatBytes(storage.projection.uploadGrowthPerMonth)}/mois</strong>{" "}
                  <span className="text-muted-foreground">
                    ({formatPercent(storage.projection.photoShare)} des recettes ont une photo envoyée)
                  </span>
                </li>
              </ul>
              <Note>
                Extrapolation linéaire à partir des poids moyens ci-dessus : ne tient pas compte des
                todos, listes et événements, ni de l&apos;évolution du nombre d&apos;utilisateurs.
              </Note>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
