import { notFound } from "next/navigation";
import {
  KID_ICON_IDS,
  KID_ICON_LABELS,
  KID_ICON_CATEGORIES,
  KID_ICON_CATEGORY_LABELS,
  KidIcon,
  type KidIconCategory,
} from "@/components/kids/icons";

export const metadata = { title: "Planche des icônes (interne)", robots: { index: false, follow: false } };

const CATS = Object.keys(KID_ICON_CATEGORY_LABELS) as KidIconCategory[];

function Sheet({ dark }: { dark?: boolean }) {
  return (
    <section className={`${dark ? "dark bg-[#212226] text-[#e4e6ea]" : "bg-white text-[#1d1d22]"} rounded-2xl p-5`}>
      <h2 className="mb-4 text-base font-semibold">{dark ? "Sombre" : "Clair"}</h2>
      {CATS.map((cat) => (
        <div key={cat} className="mb-5">
          <h3 className="mb-2 text-sm font-medium opacity-70">{KID_ICON_CATEGORY_LABELS[cat]}</h3>
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {KID_ICON_IDS.filter((id) => KID_ICON_CATEGORIES[id] === cat).map((id) => (
              <li key={id} className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-2 dark:border-white/15">
                <KidIcon id={id} size={64} />
                <span className="flex items-end gap-2">
                  <KidIcon id={id} size={24} decorative />
                  <KidIcon id={id} size={40} decorative />
                </span>
                <code className="text-[11px]">{id}</code>
                <span className="text-center text-[11px] opacity-70">{KID_ICON_LABELS[id]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default function KidIconsDemo() {
  // Page interne : absente en production.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Bibliothèque d&apos;images du Semainier ({KID_ICON_IDS.length})</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Sheet />
        <Sheet dark />
      </div>
    </main>
  );
}
