/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { OFFLINE_CACHES } from "@/lib/offlineCache";

// Service worker de la PWA, compilé en public/sw.js par @serwist/next
// (next.config.mjs). Voir docs/app-mobile.md, étape 1.2.
//
// Règle : les réponses d'API ne sont gardées hors ligne que route par route,
// quand un usage le justifie (OFFLINE_API ci-dessous), et effacées à la
// déconnexion (src/lib/offlineCache.ts).

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Une page redirigée (vers /login, /consentement…) ne doit pas être gardée
// sous l'URL demandée : hors ligne, /todos afficherait l'écran de connexion.
const skipRedirected: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) =>
    response.status === 200 && !response.redirected ? response : null,
};

const isPage = (pathname: string) => !pathname.startsWith("/api/");

// Lectures d'API gardées pour le hors ligne (étape 1.3) :
// - la session, sans quoi useAuth renvoie vers /login dès que le réseau manque ;
// - les groupes et fonctionnalités, qui construisent la navigation ;
// - les listes de courses, l'usage en magasin.
const OFFLINE_API = new Set(["/api/auth/session", "/api/groups", "/api/features", "/api/lists"]);

const runtimeCaching: RuntimeCaching[] = [
  // Pages : toujours le réseau d'abord, la dernière version vue en secours.
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin && request.mode === "navigate" && isPage(url.pathname),
    handler: new NetworkFirst({
      cacheName: OFFLINE_CACHES.pages,
      networkTimeoutSeconds: 5,
      plugins: [skipRedirected, new ExpirationPlugin({ maxEntries: 32 })],
    }),
  },
  // Charges RSC des navigations côté client (hors préchargements, trop nombreux).
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin &&
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") !== "1" &&
      isPage(url.pathname),
    handler: new NetworkFirst({
      cacheName: OFFLINE_CACHES.rsc,
      networkTimeoutSeconds: 5,
      plugins: [skipRedirected, new ExpirationPlugin({ maxEntries: 32 })],
    }),
  },
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && OFFLINE_API.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: OFFLINE_CACHES.api,
      networkTimeoutSeconds: 4,
      plugins: [skipRedirected],
    }),
  },
  // Images optimisées par Next (photos de recettes).
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/_next/image",
    handler: new StaleWhileRevalidate({
      cacheName: OFFLINE_CACHES.images,
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 3600 })],
    }),
  },
  // Photos envoyées par les utilisateurs : une URL ne change jamais de contenu.
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/uploads/"),
    handler: new CacheFirst({
      cacheName: OFFLINE_CACHES.images,
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 3600 })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/hors-ligne",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// ─── Notifications push (étape 1.4, src/lib/push.ts) ───────────

type PushPayload = { title: string; body: string; url: string; tag?: string };

self.addEventListener("push", (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    return;
  }
  if (!payload?.title) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      data: { url: payload.url },
    })
  );
});

// Clic : on ramène au premier plan une fenêtre de l'app déjà ouverte (sur la
// bonne page), sinon on en ouvre une.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | null)?.url ?? "/";
  // Seulement un chemin de l'app, jamais une URL externe (« //site » en est une).
  const isAppPath = path.startsWith("/") && !path.startsWith("//");
  const target = new URL(isAppPath ? path : "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        if (client.url !== target) await client.navigate(target).catch(() => {});
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
