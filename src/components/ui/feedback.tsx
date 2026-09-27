"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Remplace confirm() et alert() du navigateur : dans l'app installée (et plus
// tard dans la coque Capacitor) ces boîtes natives affichent « minddump.fr »
// en titre et bloquent la page.

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, kind?: ToastKind) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_DURATION = 4000;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss]
  );

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}

      <DialogPrimitive.Root open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 animate-[fade-in_150ms_ease-out]" />
          <DialogPrimitive.Content
            className={cn(
              "fixed z-[60] bg-card text-card-foreground shadow-xl border",
              "inset-x-0 bottom-0 rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
              "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6",
              "animate-[sheet-in_200ms_ease-out] sm:animate-[fade-in_150ms_ease-out]"
            )}
          >
            <DialogPrimitive.Title className="text-base font-semibold">{pending?.title}</DialogPrimitive.Title>
            {pending?.description ? (
              <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                {pending.description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{pending?.title}</DialogPrimitive.Description>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => settle(false)}>
                {pending?.cancelLabel ?? "Annuler"}
              </Button>
              <Button
                variant={pending?.destructive ? "destructive" : "default"}
                className="h-11 sm:h-9"
                onClick={() => settle(true)}
                autoFocus
              >
                {pending?.confirmLabel ?? "Confirmer"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 md:items-end md:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg animate-[toast-in_200ms_ease-out]"
          >
            {t.kind === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            )}
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fermer la notification"
              className="-m-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback doit être utilisé dans FeedbackProvider");
  return ctx;
}
