"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hauteur laissée par le clavier à l'écran (iOS ne réduit pas la fenêtre, seulement le
 * `visualViewport`). Sans clavier : { kb: 0, vh: null } et la feuille garde ses réglages.
 */
/** Barre d'accessoires du clavier iOS (flèches et coche) : hors du `visualViewport`, environ 44 pt. */
const IOS_ACCESSORY_BAR = 44;
const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function useKeyboardInset(active: boolean) {
  const [inset, setInset] = React.useState<{ kb: number; vh: number | null }>({ kb: 0, vh: null });
  React.useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      // Pincer pour zoomer réduit aussi le visualViewport : ce n'est pas un clavier.
      if (vv.scale > 1.01 || kb < 80) setInset((cur) => (cur.kb === 0 && cur.vh === null ? cur : { kb: 0, vh: null }));
      else {
        // Sur iOS, la barre d'accessoires recouvre le bas du viewport visible : on remonte le pied d'autant.
        const bar = isIOS() ? IOS_ACCESSORY_BAR : 0;
        setInset({ kb: kb + bar, vh: Math.round(vv.height) - bar });
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset({ kb: 0, vh: null });
    };
  }, [active]);
  return inset;
}

/**
 * Feuille du Semainier : tiroir bas sur mobile (92 % de la hauteur au plus, zone
 * sûre respectée), fenêtre centrée à partir de md. Entrée en fondu + translation
 * de 24 px sur 200 ms (réduite à rien en `prefers-reduced-motion`, voir globals.css).
 */
export function KidsSheet({
  open,
  onOpenChange,
  title,
  description,
  headerLeading,
  headerTrailing,
  footer,
  children,
  level = 0,
  className,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Lu par les lecteurs d'écran, jamais affiché. */
  description: string;
  headerLeading?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 0 = feuille principale, 1 = feuille ouverte par-dessus (sélecteur d'image). */
  level?: 0 | 1;
  className?: string;
  hideClose?: boolean;
}) {
  const { kb, vh } = useKeyboardInset(open);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn("fixed inset-0 bg-black/50 animate-[fade-in_150ms_ease-out]", level === 0 ? "z-50" : "z-55")}
        />
        <DialogPrimitive.Content
          data-keyboard={kb > 0 ? "open" : undefined}
          // Clavier ouvert (mobile) : la feuille se pose sur le clavier, son pied reste visible,
          // et son haut ne passe jamais sous l'encoche.
          style={
            kb > 0 && vh !== null
              ? ({ "--sheet-bottom": `${kb}px`, "--sheet-max": `${vh}px` } as React.CSSProperties)
              : undefined
          }
          onOpenAutoFocus={(e) => {
            // Le focus va au titre, pas au premier champ : pas de clavier ouvert d'office sur mobile.
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheet-title]")?.focus();
          }}
          className={cn(
            "fixed flex max-h-[92dvh] flex-col bg-card text-card-foreground shadow-xl outline-hidden",
            "inset-x-0 bottom-(--sheet-bottom,0px) rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)] data-[keyboard=open]:pb-0",
            "max-md:data-[keyboard=open]:max-h-[calc(var(--sheet-max)-env(safe-area-inset-top)-0.5rem)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[1.75rem] md:pb-0",
            "animate-[sheet-in_200ms_ease-out] md:animate-[fade-in_150ms_ease-out]",
            level === 0 ? "z-50" : "z-56",
            className
          )}
        >
          <div className="flex shrink-0 items-center gap-1 px-3 pb-1 pt-3">
            {headerLeading}
            <DialogPrimitive.Title
              data-sheet-title
              tabIndex={-1}
              className="min-w-0 flex-1 truncate px-2 text-xl font-extrabold outline-hidden first-letter:uppercase"
            >
              {title}
            </DialogPrimitive.Title>
            {headerTrailing}
            {!hideClose && (
              <DialogPrimitive.Close
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            )}
          </div>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">{children}</div>
          {footer && <div className="shrink-0 border-t border-border px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
