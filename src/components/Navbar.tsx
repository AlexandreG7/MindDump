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
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { useIsoLayoutEffect } from "@/lib/motionUi";
import { useGroupContext } from "./GroupContext";
import { useFeaturesContext, type FeatureKey } from "./FeaturesContext";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { href: string; label: string; shortLabel?: string; icon: typeof LayoutDashboard; feature: FeatureKey | null };

// Barre du bas mobile : 5 rubriques du quotidien (dont Recettes, utile en
// cuisine) puis « Plus » = 6 emplacements de ~59 px, tous avec leur libellé.
// Une pilule glisse (transform) sous la rubrique active, à l'aplat de son module.
const MOBILE_TABS = 5;

type NavTone = "home" | "todo" | "list" | "meal" | "agenda";
const NAV_TONE: Record<string, NavTone> = {
  "/": "home",
  "/todos": "todo",
  "/calendar": "agenda",
  "/lists": "list",
  "/recipes": "meal",
  "/kids": "list",
};
const toneOf = (href: string): NavTone => NAV_TONE[href] ?? "home";

// Aplat et texte de la rubrique active. Classes en toutes lettres (Tailwind).
const ACTIVE: Record<NavTone, { bg: string; fg: string; css: string }> = {
  home: { bg: "bg-ink-foreground", fg: "text-ink", css: "hsl(var(--on-ink))" },
  todo: { bg: "bg-tone-todo", fg: "text-on-tone", css: "hsl(var(--tone-todo))" },
  list: { bg: "bg-tone-list", fg: "text-on-tone", css: "hsl(var(--tone-list))" },
  meal: { bg: "bg-tone-meal", fg: "text-on-tone", css: "hsl(var(--tone-meal))" },
  agenda: { bg: "bg-tone-agenda", fg: "text-on-tone", css: "hsl(var(--tone-agenda))" },
};

/** Marque : l'icône de l'app (src/app/icon.svg), en SVG pour ne rien télécharger. */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#F97316" />
      <path d="M9 23V10l7 8 7-8v13" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: LayoutDashboard, feature: null },
  { href: "/todos", label: "Tâches", icon: CheckSquare, feature: "todos" as FeatureKey },
  { href: "/calendar", label: "Agenda", icon: Calendar, feature: "calendar" as FeatureKey },
  { href: "/lists", label: "Listes", icon: ShoppingCart, feature: "lists" as FeatureKey },
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

  // Fond chaud et jetons de l'app v2 : seulement une fois connecté (la landing,
  // la connexion et les pages publiques gardent leur fond).
  // L'écran mural (/wall/<token>) couvre tout : pas de dock caché dessous, atteignable au clavier.
  const hideNav = pathname === "/consentement" || pathname.startsWith("/wall/");
  const showShell = isLoggedIn && !hideNav;
  useIsoLayoutEffect(() => {
    if (!showShell) return;
    document.body.classList.add("app-skin");
    return () => document.body.classList.remove("app-skin");
  }, [showShell]);

  // L'écran de consentement bloque l'app : pas de navigation tant qu'il n'est pas validé.
  if (!isLoggedIn || hideNav) return null;

  const activeTab = tabItems.findIndex((i) => isActive(i.href));
  // « Plus » porte la pilule quand aucune des rubriques n'est active.
  const pillIndex = activeTab >= 0 ? activeTab : tabItems.length;
  const pillTone = activeTab >= 0 ? ACTIVE[toneOf(tabItems[activeTab].href)] : null;
  const cols = tabItems.length + 1;
  const sidebarLink = "text-ink-foreground/75 hover:bg-ink-foreground/10 hover:text-ink-foreground";

  return (
    <>
      {/* Barre latérale (ordinateur) : panneau d'encre flottant */}
      <nav
        aria-label="Navigation principale"
        className={cn(
          "hidden md:flex md:flex-col m-3 mr-0 mt-[calc(0.75rem+env(safe-area-inset-top))] rounded-4xl bg-ink text-ink-foreground overflow-y-auto shrink-0 transition-[width,padding] duration-200",
          collapsed ? "md:w-18 p-2.5" : "md:w-64 p-4"
        )}
      >
        <div className={cn("mb-8 flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <BrandMark className="h-10 w-10 shrink-0 rounded-xl" />
              <div>
                <p className="font-display text-[1.375rem]">MindDump</p>
                <p className="mt-0.5 text-xs text-ink-foreground/70">Vide ta charge mentale</p>
              </div>
            </div>
          )}
          {collapsed && <BrandMark className="h-10 w-10 shrink-0 rounded-xl" />}
          <button
            onClick={toggleCollapsed}
            className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", sidebarLink)}
            title={collapsed ? "Ouvrir le menu" : "Replier le menu"}
            aria-label={collapsed ? "Ouvrir le menu" : "Replier le menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const a = ACTIVE[toneOf(item.href)];
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center rounded-full text-base font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
                  collapsed ? "justify-center" : "gap-3 px-4",
                  active ? cn(a.bg, a.fg) : sidebarLink
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </div>

        {/* ── Group switcher ── */}
        {groups.length > 0 && !collapsed && (
          <div className="mt-4 border-t border-ink-foreground/15 pt-4 relative">
            <p className="text-xs font-bold text-ink-foreground/70 px-4 mb-1.5">Groupe actif</p>
            <button
              onClick={() => setGroupDropOpen((o) => !o)}
              aria-expanded={groupDropOpen}
              aria-label={`Groupe actif : ${currentGroup?.name ?? "aucun"}. Changer de groupe`}
              className={cn("w-full flex h-11 items-center justify-between gap-2 px-4 rounded-full text-sm transition-colors", sidebarLink)}
            >
              <span className="flex items-center gap-2 truncate">
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate font-bold">{currentGroup?.name ?? "Choisir un groupe"}</span>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", groupDropOpen && "rotate-180")} />
            </button>

            {groupDropOpen && (
              <div className="mt-1 rounded-2xl bg-ink-foreground/10 overflow-hidden z-10 relative">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setCurrentGroupId(g.id); setGroupDropOpen(false); }}
                    aria-pressed={currentGroupId === g.id}
                    className={cn(
                      "w-full flex h-11 items-center gap-2 px-4 text-sm transition-colors text-left",
                      currentGroupId === g.id ? "bg-tone-todo font-bold text-on-tone" : "hover:bg-ink-foreground/10"
                    )}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {g.isDefault && <span className="ml-auto text-xs opacity-70 shrink-0">défaut</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {groups.length > 0 && collapsed && (
          <div className="mt-4 border-t border-ink-foreground/15 pt-4 flex justify-center">
            <Link
              href="/profile"
              title={currentGroup?.name ?? "Groupes"}
              aria-label={currentGroup ? `Groupe actif : ${currentGroup.name}` : "Groupes"}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", sidebarLink)}
            >
              <Users className="h-5 w-5" />
            </Link>
          </div>
        )}

        {/* ── Profil ── */}
        <div className="border-t border-ink-foreground/15 pt-4 mt-4">
          <Link
            href="/profile"
            title={collapsed ? (userName ?? userEmail ?? "Profil") : undefined}
            className={cn(
              "flex items-center rounded-full mb-1 transition-colors group",
              collapsed ? "justify-center h-12" : "gap-3 px-2 h-14",
              pathname === "/profile" ? "bg-ink-foreground text-ink" : sidebarLink
            )}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="h-9 w-9 rounded-full shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-tone-todo flex items-center justify-center shrink-0">
                <span className="text-sm font-extrabold text-on-tone">{(userName ?? userEmail ?? "?")[0].toUpperCase()}</span>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{userName ?? userEmail}</p>
                {userName && <p className="text-xs truncate opacity-70">{userEmail}</p>}
              </div>
            )}
            {!collapsed && (
              <Settings className="h-3.5 w-3.5 mr-2 shrink-0 opacity-0 group-hover:opacity-100 touch:opacity-100 transition-opacity" />
            )}
          </Link>

          {!collapsed && (
            <div className="flex items-center gap-1">
              {!skipAuth && (
                <button
                  type="button"
                  className={cn("flex h-11 flex-1 items-center justify-start gap-2 rounded-full px-4 text-sm font-bold transition-colors", sidebarLink)}
                  onClick={() => signOutAndClear()}
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  title="Administration"
                  aria-label="Administration"
                  className={cn("ml-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors", pathname === "/admin" ? "bg-tone-todo text-on-tone" : sidebarLink)}
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
              <ThemeToggle className={cn("flex h-11 w-11 items-center justify-center rounded-full text-ink-foreground/75 hover:bg-ink-foreground/10 hover:text-ink-foreground", !isAdmin && "ml-auto")} />
            </div>
          )}

          {collapsed && (
            <ThemeToggle className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-foreground/75 hover:bg-ink-foreground/10 hover:text-ink-foreground" iconClassName="h-5 w-5" />
          )}

          {!skipAuth && collapsed && (
            <button
              onClick={() => signOutAndClear()}
              title="Déconnexion"
              aria-label="Déconnexion"
              className={cn("mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors", sidebarLink)}
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </nav>

      {/* En-tête mobile : la marque, le groupe, le thème */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(0.5rem+env(safe-area-inset-right))] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9 rounded-xl" />
          <p className="font-display text-[1.375rem]">MindDump</p>
        </div>
        <div className="flex items-center gap-1">
          {currentGroup && groups.length > 1 && (
            <span className="max-w-34 truncate rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-ink-foreground">
              <span className="sr-only">Groupe actif : </span>
              {currentGroup.name}
            </span>
          )}
          <ThemeToggle className="flex h-12 w-12 items-center justify-center rounded-full" iconClassName="h-5 w-5" />
        </div>
      </div>

      {/* Barre du bas mobile : dock d'encre flottant, six emplacements, pilule qui glisse */}
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] pointer-events-none"
      >
        <div className="pointer-events-auto relative h-16 rounded-full bg-ink p-1.5 shadow-[0_18px_40px_-14px_hsl(222_26%_9%/0.65)] ring-1 ring-ink-foreground/10">
          <span
            aria-hidden
            className="dock-pill absolute bottom-1.5 left-1.5 top-1.5 rounded-full"
            style={{
              width: `calc((100% - 0.75rem) / ${cols})`,
              transform: `translateX(${pillIndex * 100}%)`,
              backgroundColor: pillTone ? pillTone.css : "hsl(var(--on-ink) / 0.16)",
            }}
          />
          <ul className="relative grid h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {tabItems.map((item, i) => {
              const active = activeTab === i;
              const a = ACTIVE[toneOf(item.href)];
              return (
                <li key={item.href} className="h-full">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/tab flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-extrabold transition-colors duration-200",
                      active ? a.fg : "text-ink-foreground/75"
                    )}
                  >
                    <item.icon className="h-5.5 w-5.5 transition-transform duration-150 group-active/tab:scale-90" strokeWidth={active ? 2.5 : 2} />
                    {item.shortLabel ?? item.label}
                  </Link>
                </li>
              );
            })}
            <li className="h-full">
              <button
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
                aria-haspopup="dialog"
                className={cn(
                  "group/tab flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-extrabold transition-colors duration-200",
                  moreActive && activeTab < 0 ? "text-ink-foreground" : "text-ink-foreground/75"
                )}
              >
                <MoreHorizontal className="h-5.5 w-5.5 transition-transform duration-150 group-active/tab:scale-90" strokeWidth={moreActive ? 2.5 : 2} />
                Plus
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Feuille « Plus » */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="md:hidden fixed inset-0 z-50 bg-black/50 animate-[fade-in_150ms_ease-out]" />
          <DialogPrimitive.Content className="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-4xl bg-card pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] shadow-xl animate-[sheet-in_200ms_ease-out]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden />
            <DialogPrimitive.Title className="font-display mb-3 px-2 text-[1.75rem]">Plus</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Autres rubriques et réglages</DialogPrimitive.Description>

            {groups.length > 1 && (
              <div className="mb-3">
                <p className="px-2 pb-1.5 text-sm font-bold text-muted-foreground">Groupe actif</p>
                <div className="flex flex-wrap gap-2 px-1">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setCurrentGroupId(g.id)}
                      aria-pressed={currentGroupId === g.id}
                      className={cn(
                        "h-12 rounded-full px-5 text-base font-bold transition-colors",
                        currentGroupId === g.id ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground"
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
                    "flex h-14 items-center gap-3 rounded-full px-3 text-base font-bold transition-colors",
                    isActive(item.href) ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-accent"
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tone-todo text-on-tone">
                    <item.icon className="h-5 w-5" />
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
            {!skipAuth && (
              <div className="mt-3 border-t pt-3">
                <button
                  onClick={() => signOutAndClear()}
                  className="flex h-14 w-full items-center gap-3 rounded-full px-3 text-base font-bold text-muted-foreground transition-colors hover:bg-accent"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <LogOut className="h-5 w-5" />
                  </span>
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
