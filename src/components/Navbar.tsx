"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOutAndClear } from "@/lib/signOut";
import {
  CheckSquare,
  Calendar,
  ShoppingCart,
  ChefHat,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Users,
  ChevronDown,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Baby,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { useGroupContext } from "./GroupContext";
import { useFeaturesContext, type FeatureKey } from "./FeaturesContext";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { href: string; label: string; shortLabel?: string; icon: typeof LayoutDashboard; feature: FeatureKey | null };

// Barre d'onglets mobile : 5 emplacements au plus, le dernier étant « Plus ».
const MOBILE_TABS = 4;

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", shortLabel: "Accueil", icon: LayoutDashboard, feature: null },
  { href: "/todos", label: "Todos", icon: CheckSquare, feature: "todos" as FeatureKey },
  { href: "/calendar", label: "Calendrier", shortLabel: "Agenda", icon: Calendar, feature: "calendar" as FeatureKey },
  { href: "/lists", label: "Courses", icon: ShoppingCart, feature: "lists" as FeatureKey },
  { href: "/recipes", label: "Recettes", icon: ChefHat, feature: "recipes" as FeatureKey },
  { href: "/kids", label: "Semainier", icon: Baby, feature: "kids" as FeatureKey },
];

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && process.env.NODE_ENV !== "production";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupDropOpen, setGroupDropOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { groups, currentGroupId, currentGroup, setCurrentGroupId } = useGroupContext();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
  };

  const { flags } = useFeaturesContext();

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => item.feature === null || flags[item.feature]
  );

  const tabItems = navItems.slice(0, MOBILE_TABS);
  const moreItems = navItems.slice(MOBILE_TABS);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const moreActive = moreItems.some((i) => isActive(i.href)) || isActive("/profile") || isActive("/groups") || isActive("/admin");

  // Fermer la feuille « Plus » quand on change de page (bouton retour compris).
  useEffect(() => setMobileOpen(false), [pathname]);

  const isLoggedIn = skipAuth || !!session;
  const userName = skipAuth ? "Dev User" : session?.user?.name;
  const userEmail = skipAuth ? "dev@minddump.local" : session?.user?.email;
  const userImage = skipAuth ? null : session?.user?.image;
  // Affichage seulement : l'accès réel est vérifié côté serveur (lib/admin.ts).
  const isAdmin = !skipAuth && session?.user?.role === "admin";

  // L'écran de consentement bloque l'app : pas de navigation tant qu'il n'est pas validé.
  if (!isLoggedIn || pathname === "/consentement") return null;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className={cn(
        "hidden md:flex md:flex-col bg-card border-r overflow-y-auto shrink-0 transition-all duration-200",
        collapsed ? "md:w-16 p-2" : "md:w-64 p-4"
      )}>
        {/* Header + collapse toggle */}
        <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold">MindDump</h1>
              <p className="text-sm text-muted-foreground">Vide ta charge mentale</p>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={collapsed ? "Ouvrir le menu" : "Replier le menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                isActive(item.href)
                  ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-soft-foreground))] font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className={cn(collapsed ? "h-5 w-5" : "h-4 w-4")} />
              {!collapsed && item.label}
            </Link>
          ))}
        </div>

        {/* ── Group switcher ── */}
        {groups.length > 0 && !collapsed && (
          <div className="mt-4 border-t pt-4 relative">
            <p className="text-xs font-medium text-muted-foreground px-3 mb-1.5 uppercase tracking-wide">
              Groupe actif
            </p>
            <button
              onClick={() => setGroupDropOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">
                  {currentGroup?.name ?? "Choisir un groupe"}
                </span>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", groupDropOpen && "rotate-180")} />
            </button>

            {groupDropOpen && (
              <div className="mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10 relative">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setCurrentGroupId(g.id); setGroupDropOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                      currentGroupId === g.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {g.isDefault && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">défaut</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed group icon */}
        {groups.length > 0 && collapsed && (
          <div className="mt-4 border-t pt-4 flex justify-center">
            <Link
              href="/profile"
              title={currentGroup?.name ?? "Groupes"}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Users className="h-5 w-5" />
            </Link>
          </div>
        )}

        {/* ── User / Profile ── */}
        <div className="border-t pt-4 mt-4">
          <Link
            href="/profile"
            title={collapsed ? (userName ?? userEmail ?? "Profil") : undefined}
            className={cn(
              "flex items-center rounded-md mb-1 transition-colors group",
              collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
              pathname === "/profile"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="h-7 w-7 rounded-full shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {(userName ?? userEmail ?? "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", pathname === "/profile" ? "text-primary-foreground" : "text-foreground")}>
                  {userName ?? userEmail}
                </p>
                {userName && (
                  <p className={cn("text-xs truncate", pathname === "/profile" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {userEmail}
                  </p>
                )}
              </div>
            )}
            {!collapsed && (
              <Settings className={cn("h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 touch:opacity-100 transition-opacity", pathname === "/profile" && "opacity-100 text-primary-foreground")} />
            )}
          </Link>

          {!collapsed && (
            <div className="flex items-center gap-1">
              {!skipAuth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start gap-2 text-muted-foreground"
                  onClick={() => signOutAndClear()}
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </Button>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  title="Administration"
                  className={cn(
                    "ml-auto p-2 rounded-md transition-colors",
                    pathname === "/admin" ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
              <ThemeToggle className={cn("p-2", !isAdmin && "ml-auto")} />
            </div>
          )}

          {collapsed && <ThemeToggle className="w-full flex justify-center p-2" iconClassName="h-5 w-5" />}

          {!skipAuth && collapsed && (
            <button
              onClick={() => signOutAndClear()}
              title="Déconnexion"
              className="w-full flex justify-center p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-b pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] flex items-center justify-between">
        <h1 className="text-lg font-bold">MindDump</h1>
        <div className="flex items-center gap-1">
          {currentGroup && groups.length > 1 && (
            <span className="max-w-[9rem] truncate rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {currentGroup.name}
            </span>
          )}
          <ThemeToggle className="p-2.5" />
        </div>
      </div>

      {/* Mobile tab bar : les 4 premières rubriques, le reste dans « Plus » */}
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <ul className="flex">
          {tabItems.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  isActive(item.href) ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-6 w-6" strokeWidth={isActive(item.href) ? 2.25 : 1.75} />
                {item.shortLabel ?? item.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <button
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-haspopup="dialog"
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-6 w-6" strokeWidth={moreActive ? 2.25 : 1.75} />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      {/* Feuille « Plus » */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="md:hidden fixed inset-0 z-50 bg-black/40 animate-[fade-in_150ms_ease-out]" />
          <DialogPrimitive.Content className="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t bg-card pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] shadow-xl animate-[sheet-in_200ms_ease-out]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
            <DialogPrimitive.Title className="sr-only">Plus</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Autres rubriques et réglages</DialogPrimitive.Description>

            {groups.length > 1 && (
              <div className="mb-3">
                <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Groupe actif</p>
                <div className="flex flex-wrap gap-2 px-1">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setCurrentGroupId(g.id)}
                      aria-pressed={currentGroupId === g.id}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm transition-colors",
                        currentGroupId === g.id
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-foreground hover:bg-accent"
                      )}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              {[...moreItems, { href: "/profile", label: "Profil & Groupes", icon: Settings }, ...(isAdmin ? [{ href: "/admin", label: "Administration", icon: Shield }] : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3.5 text-[0.9375rem] transition-colors",
                    isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </div>
            {!skipAuth && (
              <div className="mt-3 border-t pt-3">
                <button
                  onClick={() => signOutAndClear()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-accent"
                >
                  <LogOut className="h-5 w-5" />
                  Déconnexion
                </button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
