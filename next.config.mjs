import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";

// En-têtes de sécurité appliqués à toutes les réponses (M1 de l'audit).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

// Service worker PWA (src/app/sw.ts → public/sw.js), voir docs/app-mobile.md.
// Désactivé en dev : un SW qui met en cache pendant qu'on code sème la confusion.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // public/ contient les photos de recettes envoyées en local (uploads/) :
  // elles n'ont rien à faire dans le précache commun.
  globPublicPatterns: [],
  // La page hors ligne n'est pas un asset du build : on la précache à part,
  // avec une révision neuve à chaque build pour qu'elle suive les mises à jour.
  additionalPrecacheEntries: [{ url: "/hors-ligne", revision: randomUUID() }],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "img.hellofresh.com" },
      { protocol: "https", hostname: "static.jow.fr" },
    ],
  },
  // Les images envoyées après le build ne sont pas servies depuis public/ :
  // une route API les lit depuis UPLOAD_DIR.
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: "/api/uploads/:path*" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // src/lib/jow.ts, hellofresh.ts et quitoque.ts exportent à la fois des
  // helpers purs utilisés côté client (partage, src/lib/share.ts) et des
  // fonctions de fetch serveur (src/lib/safeFetch.ts, protection SSRF) qui
  // importent "dns/promises" et "net" : absents du navigateur, jamais
  // appelés côté client, mais le bundle client doit quand même pouvoir
  // résoudre ces imports (à vide).
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        "dns/promises": false,
        net: false,
      };
    }
    return config;
  },
};

export default withSerwist(nextConfig);
