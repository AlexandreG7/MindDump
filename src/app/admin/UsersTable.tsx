"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminUsersPage, SortDir, UserSortKey } from "@/lib/adminStats";
import { formatDate, formatNumber } from "./format";

const COLUMNS: { key: UserSortKey; label: string; numeric?: boolean }[] = [
  { key: "email", label: "Utilisateur" },
  { key: "createdAt", label: "Inscription" },
  { key: "recipes", label: "Recettes", numeric: true },
  { key: "todos", label: "Todos", numeric: true },
  { key: "lists", label: "Listes", numeric: true },
  { key: "groups", label: "Groupes", numeric: true },
  { key: "apiKey", label: "Clé API" },
  { key: "lastLoginAt", label: "Dernière connexion" },
];

export function UsersTable({ initial }: { initial: AdminUsersPage }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (sort: UserSortKey, dir: SortDir, page: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ sort, dir, page: String(page) });
    const res = await fetch(`/api/admin/users?${params}`);
    setLoading(false);
    if (!res.ok) {
      setError("Impossible de charger les utilisateurs.");
      return;
    }
    setData(await res.json());
  };

  const toggleSort = (key: UserSortKey) => {
    const dir: SortDir = data.sort === key && data.dir === "desc" ? "asc" : "desc";
    load(key, dir, 1);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className={`w-full text-sm ${loading ? "opacity-60" : ""}`}>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    data.sort === col.key ? (data.dir === "asc" ? "ascending" : "descending") : "none"
                  }
                  className={`px-3 py-2.5 font-medium whitespace-nowrap ${col.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {col.label}
                    {data.sort === col.key &&
                      (data.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-3 py-2 min-w-[200px]">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{u.email ?? "—"}</span>
                    {u.isAdmin && (
                      <span title="Administrateur">
                        <Shield className="h-3 w-3 text-primary shrink-0" />
                      </span>
                    )}
                  </div>
                  {u.name && <div className="text-xs text-muted-foreground truncate">{u.name}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.recipes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.todos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.lists)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.groups)}</td>
                <td className="px-3 py-2">
                  {u.hasApiKey ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Check className="h-3 w-3" />Oui
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Non</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {formatDate(u.lastLoginAt, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatNumber(data.total)} utilisateur{data.total > 1 ? "s" : ""}
          {data.pages > 1 && ` · page ${data.page} / ${data.pages}`}
        </span>
        {data.pages > 1 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={loading || data.page <= 1}
              onClick={() => load(data.sort, data.dir, data.page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || data.page >= data.pages}
              onClick={() => load(data.sort, data.dir, data.page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        « Dernière connexion » n&apos;est renseignée qu&apos;à partir du déploiement du suivi des
        connexions. « Groupes » compte les adhésions, groupe personnel inclus.
      </p>
    </div>
  );
}
