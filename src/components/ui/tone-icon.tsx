import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/** Pastille d'icône de module (36 px) : fond doux, icône à l'encre de la teinte. */
export function ToneIcon({
  icon: Icon,
  tone,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.soft, t.ink, className)}>
      <Icon className="h-[1.125rem] w-[1.125rem]" />
    </span>
  );
}
