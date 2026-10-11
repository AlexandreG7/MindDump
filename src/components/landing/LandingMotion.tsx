"use client";

import { useEffect } from "react";

/**
 * Contrôleur de mouvement de la landing. Le HTML est déjà complet et lisible :
 * ce composant ne fait qu'améliorer, et seulement si le visiteur ne demande pas
 * de mouvement réduit.
 *
 * - Immédiat et léger : en-tête, déclenchement des maquettes (IntersectionObserver).
 * - Différé (idle) : GSAP, ScrollTrigger et Lenis, dans un chunk à part, pour que
 *   le premier écran ne paie ni leur poids ni leur exécution.
 * - Jamais dans l'app connectée ni la coque native : la landing n'est servie
 *   qu'aux visiteurs non connectés, et `/` redirige vers /login dans la coque.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-lp-root]");
    if (!root) return;

    const header = root.querySelector<HTMLElement>("[data-lp-header]");
    const onScroll = () => header?.setAttribute("data-scrolled", String(root.scrollTop > 16));
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const cleanups: Array<() => void> = [() => root.removeEventListener("scroll", onScroll)];

    // ── Ancres du menu ──────────────────────────────────────────────────────
    // Les scènes sont des cartes `sticky` : leur rectangle à l'écran dépend du
    // défilement en cours (collées, elles restent à leur cran). Viser ce
    // rectangle ne bouge presque pas depuis le bas de page. On vise donc la
    // position « naturelle » de la carte (celle de son emplacement dans la
    // colonne), déduite des hauteurs de mise en page, qu'aucune transformation
    // ni aucun collage ne fausse.
    let lenisRef: { scrollTo: (y: number, o?: { immediate?: boolean }) => void } | null = null;

    const layoutTop = (el: HTMLElement): number => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== root) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };
    const naturalTop = (el: HTMLElement): number => {
      const parent = el.parentElement;
      if (getComputedStyle(el).position !== "sticky" || !parent) return layoutTop(el);
      const cs = getComputedStyle(parent);
      const gap = parseFloat(cs.rowGap) || 0;
      let y = layoutTop(parent) + parent.clientTop + (parseFloat(cs.paddingTop) || 0);
      for (const sib of Array.from(parent.children)) {
        if (sib === el) break;
        if (sib instanceof HTMLElement) y += sib.offsetHeight + gap;
      }
      return y;
    };
    // Où la carte se pose sous l'en-tête : son cran de collage si elle est
    // sticky, sinon juste sous l'en-tête.
    const anchorScrollTop = (el: HTMLElement): number => {
      const cs = getComputedStyle(el);
      const below = cs.position === "sticky" ? parseFloat(cs.top) || 0 : (header?.offsetHeight ?? 64) + 8;
      return Math.max(0, Math.round(naturalTop(el) - below));
    };
    const goTo = (el: HTMLElement, immediate = false) => {
      const y = anchorScrollTop(el);
      if (lenisRef) lenisRef.scrollTo(y, { immediate });
      else root.scrollTo({ top: y, behavior: immediate ? "instant" : "smooth" });
    };

    const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-lp-anchor]"));
    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const target = root.querySelector<HTMLElement>(a.getAttribute("href") || "");
      if (!target) return;
      e.preventDefault();
      goTo(target);
      if (location.hash !== a.hash) history.pushState(null, "", a.hash);
    };
    anchors.forEach((a) => a.addEventListener("click", onAnchorClick));
    cleanups.push(() => anchors.forEach((a) => a.removeEventListener("click", onAnchorClick)));

    // Chargement direct sur /#ancre, et retour/avance de l'historique.
    const hashTarget = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      return id ? root.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
    };
    const syncToHash = (immediate: boolean) => {
      const t = hashTarget();
      if (t) goTo(t, immediate);
    };
    const onPop = () => syncToHash(false);
    window.addEventListener("popstate", onPop);
    cleanups.push(() => window.removeEventListener("popstate", onPop));

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.setAttribute("data-anim", "1");

      // Les maquettes jouent leur séquence en entrant dans l'écran, et la
      // rejouent quand on revient dessus.
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting)),
        { root, threshold: 0.3, rootMargin: "0px 0px -8% 0px" }
      );
      root.querySelectorAll("[data-mock]").forEach((el) => io.observe(el));
      cleanups.push(() => {
        io.disconnect();
        root.removeAttribute("data-anim");
      });

      let disposed = false;
      let teardown: (() => void) | null = null;

      const boot = async () => {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
        if (disposed) return;

        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.defaults({ scroller: root });

        // Lenis, piloté par le ticker GSAP : un seul requestAnimationFrame.
        const lenis = new Lenis({
          wrapper: root,
          content: root.firstElementChild as HTMLElement,
          autoRaf: false,
          duration: 1.05,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
        root.setAttribute("data-lenis", "1");
        lenisRef = lenis;
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        const seeded = (i: number, k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        const offsetIn = (el: HTMLElement, ancestor: HTMLElement) => {
          let x = 0;
          let y = 0;
          let node: HTMLElement | null = el;
          while (node && node !== ancestor) {
            x += node.offsetLeft;
            y += node.offsetTop;
            node = node.offsetParent as HTMLElement | null;
          }
          return { x, y };
        };

        const ctx = gsap.context(() => {
          // 1 · Révélations douces des blocs qui ne sont pas déjà à l'écran.
          root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
            if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
            gsap.from(el, {
              opacity: 0,
              y: 36,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            });
          });

          // 2 · Parallaxe des cartes du hero.
          const hero = root.querySelector<HTMLElement>(".lp2-hero");
          if (hero) {
            root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
              gsap.to(el, {
                y: Number(el.dataset.parallax),
                ease: "none",
                scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
              });
            });
          }

          // 3 · Chaos → ordre. L'état par défaut du HTML est l'ordre ; le scrub
          // part du chaos et y revient.
          const chaos = root.querySelector<HTMLElement>("[data-chaos]");
          const stage = chaos?.querySelector<HTMLElement>("[data-chaos-stage]");
          if (chaos && stage) {
            const items = gsap.utils.toArray<HTMLElement>("[data-item]", chaos);
            const decor = gsap.utils.toArray<HTMLElement>("[data-decor]", chaos);
            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: chaos,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.6,
                invalidateOnRefresh: true,
              },
            });

            items.forEach((item, i) => {
              const note = item.querySelector("[data-note]");
              const row = item.querySelector("[data-row]");
              const at = 0.05 + i * 0.03;
              const scatter = () => {
                const base = offsetIn(item, stage);
                const w = item.offsetWidth;
                const h = item.offsetHeight;
                return {
                  x: stage.offsetWidth * (0.04 + 0.92 * seeded(i, 1)) - w / 2 - base.x,
                  y: stage.offsetHeight * (0.1 + 0.8 * seeded(i, 2)) - h / 2 - base.y,
                };
              };
              tl.fromTo(
                item,
                {
                  x: () => scatter().x,
                  y: () => scatter().y,
                  rotation: -13 + seeded(i, 3) * 26,
                  scale: 1.08,
                  zIndex: 4,
                },
                { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.42, ease: "power3.inOut" },
                at
              );
              if (note) tl.fromTo(note, { opacity: 1 }, { opacity: 0, duration: 0.12 }, at + 0.3);
              if (row) tl.fromTo(row, { opacity: 0 }, { opacity: 1, duration: 0.12 }, at + 0.3);
            });

            if (decor.length) {
              tl.to(decor, { opacity: 0, scale: 0.5, y: -40, duration: 0.18, stagger: 0.03 }, 0.3);
            }
            const lead = chaos.querySelector("[data-chaos-lead]");
            const range = chaos.querySelector("[data-chaos-range]");
            if (lead) tl.to(lead, { opacity: 0.3, duration: 0.25 }, 0.45);
            if (range) tl.fromTo(range, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.22 }, 0.62);
            tl.to({}, { duration: 0.12 }); // un temps de lecture avant de repartir
          }
        }, root);

        // 4 · Empilement des scènes (sticky en CSS) : la carte recouverte recule.
        const mm = gsap.matchMedia();
        mm.add("(min-width: 900px) and (min-height: 700px)", () => {
          const scenes = gsap.utils.toArray<HTMLElement>("[data-scene]", root);
          scenes.slice(0, -1).forEach((scene, i) => {
            gsap.to(scene, {
              scale: 0.945,
              ease: "none",
              scrollTrigger: {
                trigger: scenes[i + 1],
                start: "top bottom-=80",
                end: "top top+=140",
                scrub: true,
              },
            });
          });
        });

        const refresh = () => {
          ScrollTrigger.refresh();
          // La mise en page a pu bouger (polices, images) : on se recale sur l'ancre.
          if (location.hash) syncToHash(true);
        };
        window.addEventListener("load", refresh);
        document.fonts?.ready.then(refresh);
        const rafId = requestAnimationFrame(refresh);

        teardown = () => {
          cancelAnimationFrame(rafId);
          window.removeEventListener("load", refresh);
          mm.revert();
          ctx.revert();
          gsap.ticker.remove(tick);
          lenisRef = null;
          lenis.destroy();
          root.removeAttribute("data-lenis");
        };
      };

      type Idle = {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        cancelIdleCallback?: (h: number) => void;
      };
      const w = window as unknown as Idle;
      const handle = w.requestIdleCallback
        ? w.requestIdleCallback(() => void boot(), { timeout: 1800 })
        : window.setTimeout(() => void boot(), 700);
      cleanups.push(() => {
        disposed = true;
        if (w.requestIdleCallback) w.cancelIdleCallback?.(handle);
        else clearTimeout(handle);
        teardown?.();
      });
    }

    // Recalage initial sur l'ancre de l'URL, une fois la mise en page posée
    // (data-anim change la hauteur de la section « chaos »), puis polices chargées.
    if (location.hash) {
      const raf = requestAnimationFrame(() => syncToHash(true));
      document.fonts?.ready.then(() => syncToHash(true));
      cleanups.push(() => cancelAnimationFrame(raf));
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
