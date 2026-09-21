import type { Metadata } from "next";
import { Caveat, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { themeInitScript } from "@/lib/theme";
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
          <div className="flex h-screen overflow-hidden">
            <Navbar />
            <main className="flex-1 md:p-8 p-4 pt-20 md:pt-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
