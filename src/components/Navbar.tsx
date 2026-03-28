"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  CheckSquare,
  Calendar,
  ShoppingCart,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Users,
  ChevronDown,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useGroupContext } from "./GroupContext";
import { useFeaturesContext, type FeatureKey } from "./FeaturesContext";

const ALL_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, feature: null },
  { href: "/todos", label: "Todos", icon: CheckSquare, feature: "todos" as FeatureKey },
  { href: "/calendar", label: "Calendrier", icon: Calendar, feature: "calendar" as FeatureKey },
  { href: "/lists", label: "Courses", icon: ShoppingCart, feature: "lists" as FeatureKey },
  { href: "/recipes", label: "Recettes", icon: ChefHat, feature: "recipes" as FeatureKey },
];

const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupDropOpen, setGroupDropOpen] = useState(false);
  const { groups, currentGroupId, currentGroup, setCurrentGroupId } = useGroupContext();

  const { flags } = useFeaturesContext();

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => item.feature === null || flags[item.feature]
  );

  const isLoggedIn = skipAuth || !!session;
  const userName = skipAuth ? "Dev User" : session?.user?.name;
  const userEmail = skipAuth ? "dev@minddump.local" : session?.user?.email;
  const userImage = skipAuth ? null : session?.user?.image;

  if (!isLoggedIn) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-card border-r p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold">MindDump</h1>
          <p className="text-sm text-muted-foreground">Vide ta charge mentale</p>
        </div>

        <div className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {/* ── Group switcher ── */}
        {groups.length > 0 && (
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

        {/* ── User / Profile ── */}
        <div className="border-t pt-4 mt-4">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 mb-1 transition-colors group",
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
            <Settings className={cn("h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", pathname === "/profile" && "opacity-100 text-primary-foreground")} />
          </Link>

          {!skipAuth && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          )}
        </div>
      </nav>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">MindDump</h1>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-16 px-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
                pathname === "/profile"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Settings className="h-5 w-5" />
              Profil & Groupes
            </Link>
          </div>
          {!skipAuth && (
            <div className="border-t mt-4 pt-4">
              <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
