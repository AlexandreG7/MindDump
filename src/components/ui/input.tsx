import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// Types dont le navigateur affiche un panneau natif : on l'ouvre au clic sur
// toute la cellule, pas seulement sur la petite icone a droite.
const PICKER_TYPES = ["date", "datetime-local", "time", "month", "week"];

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, ...props }, ref) => {
    const hasPicker = !!type && PICKER_TYPES.includes(type);

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(e);
      if (!hasPicker || e.defaultPrevented) return;
      const el = e.currentTarget as HTMLInputElement & {
        showPicker?: () => void;
      };
      try {
        el.showPicker?.();
      } catch {
        // showPicker() n'est pas supporte partout (Safari) ou l'input est
        // desactive : on laisse le comportement natif.
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          hasPicker && "cursor-pointer",
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
