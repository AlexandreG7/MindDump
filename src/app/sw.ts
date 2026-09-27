/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { OFFLINE_CACHES } from "@/lib/offlineCache";

// Service worker de la PWA, compilé en public/sw.js par @serwist/next
// (next.config.mjs). Voir docs/app-mobile.md, étape 1.2.
//
// Règle : aucune réponse d'API n'est mise en cache ici. Les données des
// utilisateurs ne sont gardées hors ligne que route par route, quand un
// usage le justifie (listes de courses, étape 1.3), et effacées à la
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
