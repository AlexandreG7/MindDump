import { createHash, randomUUID } from "node:crypto";
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

// Identifiant du build, figé dans le code client et serveur (src/lib/buildId.ts) :
// le client le compare à /api/version pour se recharger après un déploiement.
// SOURCE_COMMIT (transmis par Coolify, déclaré en ARG dans le Dockerfile) donne
// un identifiant stable pour un même commit ; on n'en expose que l'empreinte
// (12 caractères d'un SHA-256), jamais le SHA du commit. Sans lui : UUID.
const buildId = process.env.SOURCE_COMMIT
  ? createHash("sha256").update(process.env.SOURCE_COMMIT).digest("hex").slice(0, 12)
  : randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
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
    return [
      { source: "/:path*", headers: securityHeaders },
      // Page de confirmation de liaison (ticket dans l'URL) : aucun Referer vers un autre site.
      // « same-origin » et non « no-referrer » : avec ce dernier, le navigateur envoie
      // « Origin: null » sur le POST du formulaire, que la route refuse (vérifié sur iOS).
      // Placée après la règle générale, elle la remplace pour cet en-tête seulement.
      { source: "/api/mobile-auth/start", headers: [{ key: "Referrer-Policy", value: "same-origin" }] },
    ];
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
