"use client";

import * as React from "react";
import { useFlip } from "@/lib/motionUi";

/**
 * Conteneur de liste dont les lignes glissent avec un ressort quand l'ordre
 * change et se posent à l'arrivée (voir `useFlip`). Chaque enfant direct porte
 * `data-flip="<clé stable>"`. `signature` = clés dans l'ordre, jointes.
 */
export function FlipList({
  signature,
  className,
  children,
  as: Tag = "div",
}: {
  signature: string;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "ul";
}) {
  const ref = React.useRef<HTMLDivElement & HTMLUListElement>(null);
  useFlip(ref, signature);
  return (
    <Tag ref={ref as never} className={`relative ${className ?? ""}`}>
      {children}
    </Tag>
  );
}
