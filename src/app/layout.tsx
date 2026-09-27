import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { THEME_COLORS, themeInitScript } from "@/lib/theme";
import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";

// next/font télécharge les polices au build et les sert depuis minddump.fr :
// aucun appel à Google Fonts depuis le navigateur (IP des visiteurs, RGPD).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caveat = Caveat({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-caveat" });

export const metadata: Metadata = {
  // Base des URLs relatives ci-dessous (canonical, images Open Graph).
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  // App installée sur l'écran d'accueil iOS : plein écran, barre d'état aux
  // couleurs du thème (theme-color ci-dessous).
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  keywords: [
    "organisation familiale",
    "charge mentale",
    "liste de courses partagée",
    "menus de la semaine",
    "calendrier familial",
    "todo liste famille",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Le contenu s'étend sous l'encoche et la barre d'accueil : les marges
  // env(safe-area-inset-*) le gardent lisible (globals.css, Navbar).
  viewportFit: "cover",
  // Suit le thème du système ; ThemeContext l'ajuste si l'utilisateur force
  // un thème.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} ${inter.variable} ${caveat.variable}`}>
        <Providers>
          <div className="flex h-dvh overflow-hidden">
            <Navbar />
            <main className="flex-1 md:p-8 p-4 pt-[calc(5rem+env(safe-area-inset-top))] md:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-[calc(2rem+env(safe-area-inset-bottom))] overflow-y-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
