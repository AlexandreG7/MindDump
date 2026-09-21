"use client";

import { useState } from "react";
import type { DayPoint } from "@/lib/adminStats";
import { formatDay, formatNumber } from "./format";

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { top: 12, right: 4, bottom: 22, left: 28 };
const GAP = 2; // espace entre barres (couleur du fond)
const RADIUS = 4; // extrémité arrondie côté donnée

// Barre arrondie en haut, ancrée à plat sur la ligne de base.
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function DailyBarChart({ data, unit }: { data: DayPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(1, slot - GAP);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const hovered = hover !== null ? data[hover] : null;
  // Aux extrémités, l'infobulle s'aligne sur la barre au lieu de déborder.
  const tooltipAlign =
    hover === null || (hover > 3 && hover < data.length - 4)
      ? "-translate-x-1/2"
      : hover <= 3
        ? "-translate-x-2"
        : "-translate-x-[calc(100%-0.5rem)]";

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${unit} par jour sur ${data.length} jours`}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grille discrète : ligne de base et maximum */}
          {[0, max].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {formatNumber(v)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = PAD.left + i * slot + GAP / 2;
            const h = innerH - (y(d.count) - PAD.top);
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                {/* Zone de survol plus large que la barre */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                {d.count > 0 && (
                  <path
                    d={barPath(x, y(d.count), barW, h)}
                    className={hover === i ? "fill-primary" : "fill-primary/80"}
                  />
                )}
                {/* Un libellé par semaine, calé sur le dernier jour (aujourd'hui) */}
                {(data.length - 1 - i) % 7 === 0 && (
                  <text
                    x={x + barW / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={10}
                  >
                    {formatDay(d.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && hover !== null && (
          <div
            className={`pointer-events-none absolute -top-2 -translate-y-full rounded-md ${tooltipAlign}  border border-border bg-popover px-2 py-1 text-xs shadow-sm whitespace-nowrap`}
            style={{ left: `${((PAD.left + (hover + 0.5) * slot) / WIDTH) * 100}%` }}
          >
            <span className="text-muted-foreground">{formatDay(hovered.day)} · </span>
            <span className="font-semibold text-foreground">
              {formatNumber(hovered.count)} {unit}
            </span>
          </div>
        )}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Voir les données</summary>
        <table className="mt-2 w-full max-w-xs">
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="py-0.5">{formatDay(d.day)}</td>
                <td className="py-0.5 text-right tabular-nums text-foreground">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
