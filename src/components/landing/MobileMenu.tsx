"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Item = { href: string; label: string };
type GuideLink = { slug: string; label: string };

/**
 * Menu plein écran de la landing sous `md`. Le bouton vit dans l'en-tête ; le
 * panneau est monté dans la racine `[data-lp-root]` (portail) parce que
 * l'en-tête a un `backdrop-filter`, qui captive les éléments `fixed`.
 *
 * Le défilement vers une section passe par l'évènement `lp:goto` : c'est
 * LandingMotion qui sait viser la position naturelle des cartes collantes
 * (Lenis, hash). `lp:lock` lui demande d'arrêter / relancer Lenis.
 */
export function MobileMenu({ items, guides }: { items: Item[]; guides: GuideLink[] }) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  useEffect(() => {
    setRoot(document.querySelector<HTMLElement>("[data-lp-root]"));
  }, []);

  // Panneau fermé = inerte (React 18 n'a pas la prop `inert`).
  useEffect(() => {
    panelRef.current?.toggleAttribute("inert", !open);
  }, [open, root]);

  // Page figée derrière le panneau : Lenis arrêté, racine sans défilement,
  // contenu de la page et reste de l'en-tête inertes (ni focus ni lecteur d'écran).
  const applyLock = useCallback((locked: boolean) => {
    const r = document.querySelector<HTMLElement>("[data-lp-root]");
    if (!r) return;
    const header = r.querySelector<HTMLElement>("[data-lp-header]");
    r.toggleAttribute("data-menu-open", locked);
    header?.toggleAttribute("data-menu-open", locked);
    const behind = [header?.nextElementSibling, ...Array.from(header?.querySelectorAll("[data-menu-inert]") ?? [])];
    behind.forEach((el) => el?.toggleAttribute("inert", locked));
    r.dispatchEvent(new CustomEvent("lp:lock", { detail: locked }));
  }, []);

  const close = useCallback(
    (returnFocus = true) => {
      if (!openRef.current) return;
      openRef.current = false;
      setOpen(false);
      applyLock(false);
      if (returnFocus) btnRef.current?.focus({ preventScroll: true });
    },
    [applyLock]
  );

  const toggle = () => {
    if (openRef.current) return close();
    openRef.current = true;
    setOpen(true);
    applyLock(true);
  };

  // Ouverture : le focus passe au premier lien dès que le panneau n'est plus inerte.
  useEffect(() => {
    if (!open) return;
    let tries = 0;
    let raf = 0;
    const focusFirst = () => {
      const a = panelRef.current?.querySelector<HTMLElement>("a[href]");
      a?.focus({ preventScroll: true });
      // Le panneau peut n'être « visible » qu'à l'image suivante (transition de visibility).
      if (document.activeElement !== a && tries++ < 6) raf = requestAnimationFrame(focusFirst);
    };
    focusFirst();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      // Piège à focus : le bouton (☰/✕) et les liens du panneau.
      const list = [btnRef.current, ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? [])].filter(
        (el): el is HTMLElement => !!el
      );
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !list.includes(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && close(false);
    const onPop = () => close(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      window.removeEventListener("popstate", onPop);
    };
  }, [open, close]);

  // Démontage en cours de route : on rend la page.
  useEffect(
    () => () => {
      if (openRef.current) applyLock(false);
    },
    [applyLock]
  );

  const onSection = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    close();
    document.querySelector("[data-lp-root]")?.dispatchEvent(new CustomEvent("lp:goto", { detail: hash }));
  };

  const panel = (
    <div
      ref={panelRef}
      id="lp-menu"
      className="lp2-menu on-dark"
      data-open={open ? "true" : "false"}
      role="dialog"
      aria-label="Menu"
    >
      <nav aria-label="Sections de la page" className="lp2-menu-nav">
        <ol>
          {items.map((n, i) => (
            <li key={n.href} style={{ "--i": i } as React.CSSProperties}>
              <a href={n.href} onClick={(e) => onSection(e, n.href)}>
                <span className="num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="txt">{n.label}</span>
                <ArrowRight className="h-5 w-5 ico" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="lp2-menu-cta" style={{ "--i": items.length } as React.CSSProperties}>
        <Link href="/register" className="lp2-btn lp2-btn-or !min-h-[3.4rem] w-full" onClick={() => close(false)}>
          Créer mon espace
          <ArrowRight className="arrow h-5 w-5" aria-hidden="true" />
        </Link>
        <Link href="/login" className="lp2-btn lp2-btn-ghost !min-h-[3.4rem] w-full" onClick={() => close(false)}>
          Se connecter
        </Link>
      </div>

      <nav aria-label="Guides" className="lp2-menu-guides" style={{ "--i": items.length + 1 } as React.CSSProperties}>
        <p>Les guides</p>
        <ul>
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/${g.slug}`} onClick={() => close(false)}>
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="lp2-burger md:hidden"
        aria-expanded={open}
        aria-controls="lp-menu"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={toggle}
      >
        <span className="bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      {root ? createPortal(panel, root) : null}
    </>
  );
}
