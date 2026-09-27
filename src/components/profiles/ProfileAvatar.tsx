import { cn } from "@/lib/utils";

export interface FamilyProfile {
  id: string;
  name: string;
  kind: "adult" | "child";
  color: string;
  emoji: string | null;
  birthDate: string | null;
  position: number;
  groupId: string;
  userId: string | null;
  user?: { image: string | null } | null;
  groupName?: string;
}

/**
 * Couleur de texte lisible sur la couleur d'une personne : blanc sur les
 * couleurs foncées, encre sur les claires (jaune, vert, orange…), où le blanc
 * tombe sous 3:1.
 */
export function textOn(color: string): string {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Point où le blanc et l'encre (#1c140c) offrent le même contraste.
  return lum > 0.2 ? "#1c140c" : "#fff";
}

/** Pastille d'une personne du foyer : emoji, sinon initiale, sur sa couleur. */
export function ProfileAvatar({
  profile,
  size = "md",
  className,
}: {
  profile: Pick<FamilyProfile, "name" | "color" | "emoji">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 font-semibold select-none",
        size === "sm" && "w-6 h-6 text-xs",
        size === "md" && "w-8 h-8 text-sm",
        size === "lg" && "w-12 h-12 text-xl",
        className
      )}
      style={{ backgroundColor: profile.color, color: textOn(profile.color) }}
      aria-hidden
    >
      {profile.emoji || profile.name.trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}
