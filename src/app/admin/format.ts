const nf = new Intl.NumberFormat("fr-FR");

export const formatNumber = (n: number) => nf.format(n);

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const digits = value >= 100 || i === 0 ? 0 : 1;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits })} ${units[i]}`;
}

export const formatPercent = (ratio: number) =>
  ratio.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 });

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// "2026-09-21" -> "21/09"
export function formatDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}
