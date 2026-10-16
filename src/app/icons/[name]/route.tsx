import { notFound } from "next/navigation";
import { renderAppIcon } from "@/lib/appIcon";

// Icônes PNG du manifest (src/app/manifest.ts), générées au build.
const ICONS = {
  "icon-192.png": { size: 192, shape: "rounded" },
  "icon-512.png": { size: 512, shape: "rounded" },
  "maskable-512.png": { size: 512, shape: "full" },
} as const;

type IconName = keyof typeof ICONS;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, props: { params: Promise<{ name: string }> }) {
  const params = await props.params;
  const icon = ICONS[params.name as IconName];
  if (!icon) notFound();
  return renderAppIcon(icon.size, icon.shape);
}
