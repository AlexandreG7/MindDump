import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./tone";

/** Pastille d'icône de module (40 px) : aplat de la teinte, icône à l'encre. */
export function ToneIcon({
  icon: Icon,
  tone,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[tone].block, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}
