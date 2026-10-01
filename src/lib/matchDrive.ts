"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "./native";

/**
 * Remplir le panier drive Match depuis une liste, dans l'app (docs/app-mobile.md,
 * étape 3.6 ; docs/drive-match.md).
 *
 * Le plugin natif MatchDrive ouvre le site Match dans une seconde WebView et y
 * fait tourner le script de l'extension (drive-extension/content.js). Ce script
 * n'a pas la session MindDump : ses appels remontent ici (événement « api »),
 * sont faits depuis cette page avec la session de l'utilisateur, et la réponse
 * redescend par reply(). Comme le service worker de l'extension, on ne laisse
 * passer que les routes du panier Match, et seulement pour la liste lancée.
 */

type ApiRequest = { id: number; method: string; path: string; body?: unknown };
type ApiResult = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string };

type MatchDrivePlugin = {
  open(options: { listId: string }): Promise<void>;
  reply(options: { id: number; result: ApiResult }): Promise<void>;
  addListener(event: "api", listener: (request: ApiRequest) => void): unknown;
  addListener(event: "closed", listener: () => void): unknown;
};

function plugin(): MatchDrivePlugin | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: { Plugins?: { MatchDrive?: MatchDrivePlugin } } }).Capacitor?.Plugins
    ?.MatchDrive;
}

/** Vrai dans une version de l'app qui embarque l'écran Match. */
export function useMatchDriveAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(isNativeApp() && !!plugin()), []);
  return available;
}

// Liste lancée, gardée pour la session : si la page MindDump se recharge
// pendant que l'écran Match est ouvert, le relais continue de répondre.
const ACTIVE_KEY = "minddump-match-list";
let listening = false;

function activeList(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function setActiveList(listId: string | null) {
  try {
    if (listId) sessionStorage.setItem(ACTIVE_KEY, listId);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

function allowed(method: string, path: string): boolean {
  const activeListId = activeList();
  if (!activeListId) return false;
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (method === "GET" && url.pathname === "/api/drive/match/plan") {
    return url.searchParams.get("listId") === activeListId && url.search === `?listId=${encodeURIComponent(activeListId)}`;
  }
  return (
    (method === "POST" && url.pathname === "/api/drive/match/rank" && !url.search) ||
    (method === "PUT" && url.pathname === "/api/drive/match/products" && !url.search)
  );
}

async function callApi({ method, path, body }: ApiRequest): Promise<ApiResult> {
  if (!allowed(method, path)) return { ok: false, status: 400, error: "Appel non autorisé" };
  // rank et products portent aussi la liste : elle doit être celle lancée.
  if (body && typeof body === "object" && "listId" in body && (body as { listId: unknown }).listId !== activeList()) {
    return { ok: false, status: 400, error: "Appel non autorisé" };
  }
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error =
        res.status === 401
          ? "Ta session MindDump a expiré : reconnecte-toi dans l'app."
          : (data as { error?: string } | null)?.error || `Erreur ${res.status}`;
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, error: "MindDump est injoignable : vérifie ta connexion." };
  }
}

/**
 * Relais des appels du script Match vers MindDump. Enregistré au chargement
 * de chaque page de l'app (NativeDeviceSync), pas seulement depuis les listes.
 */
export function registerMatchDriveRelay() {
  const drive = plugin();
  if (!drive || listening || !isNativeApp()) return;
  listening = true;
  drive.addListener("api", async (request) => {
    const result = await callApi(request);
    await drive.reply({ id: request.id, result }).catch(() => {});
  });
  drive.addListener("closed", () => setActiveList(null));
}

/** Ouvre l'écran Match et lance le remplissage du panier depuis cette liste. */
export async function fillMatchCart(listId: string) {
  const drive = plugin();
  if (!drive) return;
  registerMatchDriveRelay();
  setActiveList(listId);
  await drive.open({ listId });
}
