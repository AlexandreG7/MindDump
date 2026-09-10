"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * The landing page scrolls inside its own fixed container rather than the
 * window, so every observer and scroll reader needs that element as its root.
 */
export const ScrollRootContext = createContext<RefObject<HTMLDivElement> | null>(null);

export function useScrollRoot() {
  return useContext(ScrollRootContext);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);
  const rootRef = useScrollRoot();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { root: rootRef?.current ?? null, threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef, threshold, reduced]);

  return { ref, revealed };
}

type ScrubHandler = (progress: number, el: HTMLElement) => void;

/**
 * Maps how far a tall section has travelled through the viewport onto 0→1 and
 * writes it straight to the DOM as CSS variables — deliberately bypassing React
 * state so scrolling never triggers a re-render.
 */
export function useScrub<T extends HTMLElement = HTMLDivElement>(onProgress?: ScrubHandler) {
  const ref = useRef<T>(null);
  const rootRef = useScrollRoot();
  const reduced = useReducedMotion();
  const handlerRef = useRef(onProgress);
  handlerRef.current = onProgress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = rootRef?.current ?? null;

    const apply = (progress: number) => {
      el.style.setProperty("--p", progress.toFixed(4));
      handlerRef.current?.(progress, el);
    };

    if (reduced) {
      apply(1);
      return;
    }

    let ticking = false;

    const measure = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const viewportHeight = scroller ? scroller.clientHeight : window.innerHeight;
      const travel = rect.height - viewportHeight;
      apply(
        travel <= 0
          ? rect.top <= 0
            ? 1
            : 0
          : Math.min(1, Math.max(0, -rect.top / travel))
      );
    };

    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };

    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    measure();

    return () => {
      target.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, [rootRef, reduced]);

  return ref;
}

export function useTypewriter(text: string, active: boolean, speed = 42) {
  const [typed, setTyped] = useState("");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setTyped(text);
      return;
    }
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, active, reduced, speed]);

  return typed;
}

/** Normalises a sub-range of the master progress back to 0→1. */
export function phase(progress: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "p" | "h2";
}) {
  const { ref, revealed } = useReveal();
  return (
    <Tag
      ref={ref as never}
      data-revealed={revealed}
      style={{ transitionDelay: `${delay}ms` }}
      className={`lp-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
