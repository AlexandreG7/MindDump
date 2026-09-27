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
        "rounded-full flex items-center justify-center shrink-0 font-semibold text-white select-none",
        size === "sm" && "w-6 h-6 text-xs",
        size === "md" && "w-8 h-8 text-sm",
        size === "lg" && "w-12 h-12 text-xl",
        className
      )}
      style={{ backgroundColor: profile.color }}
      aria-hidden
    >
      {profile.emoji || profile.name.trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}
