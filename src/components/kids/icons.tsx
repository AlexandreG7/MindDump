import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function I({ size = 80, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

// ─── WEATHER ─────────────────────────────────────────

export function WeatherSunny(p: IconProps) {
  return (
    <I {...p}>
      <g className="kids-sun-rays">
        <line x1="40" y1="6" x2="40" y2="18" stroke="#FFA726" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="40" y1="62" x2="40" y2="74" stroke="#FFA726" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="6" y1="40" x2="18" y2="40" stroke="#FFA726" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="62" y1="40" x2="74" y2="40" stroke="#FFA726" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="16" y1="16" x2="24" y2="24" stroke="#FFA726" strokeWidth="3" strokeLinecap="round" />
        <line x1="56" y1="24" x2="64" y2="16" stroke="#FFA726" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="64" x2="24" y2="56" stroke="#FFA726" strokeWidth="3" strokeLinecap="round" />
        <line x1="56" y1="56" x2="64" y2="64" stroke="#FFA726" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="40" cy="40" r="18" fill="#FFD54F" stroke="#FFA726" strokeWidth="2.5" />
      <circle cx="34" cy="37" r="2.5" fill="#E65100" />
      <circle cx="46" cy="37" r="2.5" fill="#E65100" />
      <path d="M33 45 Q40 51 47 45" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="43" r="4" fill="#FFCC80" opacity="0.5" />
      <circle cx="52" cy="43" r="4" fill="#FFCC80" opacity="0.5" />
    </I>
  );
}

export function WeatherPartlyCloudy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="54" cy="26" r="13" fill="#FFD54F" />
      <line x1="54" y1="7" x2="54" y2="12" stroke="#FFA726" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="70" y1="26" x2="65" y2="26" stroke="#FFA726" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="65" y1="15" x2="61" y2="19" stroke="#FFA726" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="65" y1="37" x2="61" y2="33" stroke="#FFA726" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="50" r="14" fill="#E3F2FD" />
      <circle cx="40" cy="42" r="16" fill="#E3F2FD" />
      <circle cx="56" cy="48" r="12" fill="#E3F2FD" />
      <rect x="12" y="50" width="54" height="14" rx="7" fill="#E3F2FD" />
    </I>
  );
}

export function WeatherCloudy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="50" cy="32" r="12" fill="#CFD8DC" />
      <circle cx="60" cy="38" r="9" fill="#CFD8DC" />
      <rect x="40" y="38" width="26" height="10" rx="5" fill="#CFD8DC" />
      <circle cx="22" cy="48" r="14" fill="#E3F2FD" />
      <circle cx="38" cy="40" r="16" fill="#E3F2FD" />
      <circle cx="54" cy="46" r="12" fill="#E3F2FD" />
      <rect x="10" y="48" width="54" height="14" rx="7" fill="#E3F2FD" />
    </I>
  );
}

export function WeatherRainy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="22" cy="34" r="12" fill="#90A4AE" />
      <circle cx="36" cy="26" r="14" fill="#90A4AE" />
      <circle cx="52" cy="32" r="11" fill="#90A4AE" />
      <rect x="12" y="34" width="50" height="12" rx="6" fill="#90A4AE" />
      <g className="kids-rain-drops">
        <ellipse cx="24" cy="58" rx="3" ry="5" fill="#42A5F5" />
        <ellipse cx="38" cy="62" rx="3" ry="5" fill="#42A5F5" />
        <ellipse cx="52" cy="56" rx="3" ry="5" fill="#42A5F5" />
      </g>
    </I>
  );
}

export function WeatherStormy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="22" cy="30" r="12" fill="#78909C" />
      <circle cx="36" cy="22" r="14" fill="#78909C" />
      <circle cx="52" cy="28" r="11" fill="#78909C" />
      <rect x="12" y="30" width="50" height="12" rx="6" fill="#78909C" />
      <path className="kids-lightning-bolt" d="M42 42 L36 52 L44 52 L36 66" stroke="#FFD54F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </I>
  );
}

export function WeatherSnowy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="22" cy="32" r="12" fill="#B3E5FC" />
      <circle cx="36" cy="24" r="14" fill="#B3E5FC" />
      <circle cx="52" cy="30" r="11" fill="#B3E5FC" />
      <rect x="12" y="32" width="50" height="12" rx="6" fill="#B3E5FC" />
      <g className="kids-snowflake" style={{ animationDelay: "0s" }}>
        <circle cx="22" cy="56" r="4" fill="white" stroke="#90CAF9" strokeWidth="1.5" />
        <line x1="22" y1="52" x2="22" y2="60" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="56" x2="26" y2="56" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="kids-snowflake" style={{ animationDelay: "0.6s" }}>
        <circle cx="40" cy="62" r="3.5" fill="white" stroke="#90CAF9" strokeWidth="1.5" />
        <line x1="40" y1="58.5" x2="40" y2="65.5" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="36.5" y1="62" x2="43.5" y2="62" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="kids-snowflake" style={{ animationDelay: "1.2s" }}>
        <circle cx="56" cy="54" r="3" fill="white" stroke="#90CAF9" strokeWidth="1.5" />
        <line x1="56" y1="51" x2="56" y2="57" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="53" y1="54" x2="59" y2="54" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </I>
  );
}

// ─── MOODS ───────────────────────────────────────────

export function MoodVeryHappy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#FFD54F" />
      <path d="M27 35 Q31 30 35 35" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 35 Q49 30 53 35" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 44 Q40 58 52 44" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="44" r="5" fill="#FFAB91" opacity="0.5" />
      <circle cx="56" cy="44" r="5" fill="#FFAB91" opacity="0.5" />
    </I>
  );
}

export function MoodHappy(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#FFF176" />
      <circle cx="31" cy="36" r="3" fill="#5D4037" />
      <circle cx="49" cy="36" r="3" fill="#5D4037" />
      <path d="M30 46 Q40 54 50 46" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="44" r="4.5" fill="#FFAB91" opacity="0.35" />
      <circle cx="56" cy="44" r="4.5" fill="#FFAB91" opacity="0.35" />
    </I>
  );
}

export function MoodNeutral(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#FFE082" />
      <circle cx="31" cy="36" r="3" fill="#5D4037" />
      <circle cx="49" cy="36" r="3" fill="#5D4037" />
      <line x1="32" y1="50" x2="48" y2="50" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />
    </I>
  );
}

export function MoodSad(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#B3E5FC" />
      <circle cx="31" cy="36" r="3" fill="#37474F" />
      <circle cx="49" cy="36" r="3" fill="#37474F" />
      <line x1="26" y1="28" x2="34" y2="30" stroke="#37474F" strokeWidth="2" strokeLinecap="round" />
      <line x1="54" y1="28" x2="46" y2="30" stroke="#37474F" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 52 Q40 46 50 52" stroke="#37474F" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="53" cy="42" rx="2.5" ry="4" fill="#42A5F5" />
    </I>
  );
}

export function MoodAngry(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#FFCDD2" />
      <circle cx="31" cy="38" r="3" fill="#B71C1C" />
      <circle cx="49" cy="38" r="3" fill="#B71C1C" />
      <line x1="24" y1="30" x2="34" y2="33" stroke="#B71C1C" strokeWidth="3" strokeLinecap="round" />
      <line x1="56" y1="30" x2="46" y2="33" stroke="#B71C1C" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 52 Q40 48 48 52" stroke="#B71C1C" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="44" r="4" fill="#EF5350" opacity="0.4" />
      <circle cx="56" cy="44" r="4" fill="#EF5350" opacity="0.4" />
    </I>
  );
}

// ─── BINARY (Nap / Accident) ─────────────────────────

export function NapYes(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="42" r="26" fill="#CE93D8" />
      <path d="M27 38 Q31 34 35 38" stroke="#4A148C" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M45 38 Q49 34 53 38" stroke="#4A148C" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 48 Q40 51 45 48" stroke="#4A148C" strokeWidth="2" strokeLinecap="round" />
      <text x="58" y="24" fill="#7B1FA2" fontSize="14" fontWeight="bold" fontFamily="sans-serif">Z</text>
      <text x="65" y="16" fill="#7B1FA2" fontSize="10" fontWeight="bold" fontFamily="sans-serif">z</text>
    </I>
  );
}

export function NapNo(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="42" r="26" fill="#B3E5FC" />
      <circle cx="31" cy="38" r="4" fill="white" stroke="#0277BD" strokeWidth="2" />
      <circle cx="31" cy="38" r="2" fill="#0277BD" />
      <circle cx="49" cy="38" r="4" fill="white" stroke="#0277BD" strokeWidth="2" />
      <circle cx="49" cy="38" r="2" fill="#0277BD" />
      <path d="M34 48 Q40 52 46 48" stroke="#0277BD" strokeWidth="2" strokeLinecap="round" />
    </I>
  );
}

export function DryDay(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#A5D6A7" />
      <path d="M24 40 L35 52 L56 28" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </I>
  );
}

export function AccidentDay(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="30" fill="#90CAF9" />
      <ellipse cx="32" cy="36" rx="4" ry="7" fill="white" opacity="0.9" />
      <ellipse cx="48" cy="32" rx="3.5" ry="6" fill="white" opacity="0.9" />
      <ellipse cx="40" cy="48" rx="5" ry="8" fill="white" opacity="0.9" />
    </I>
  );
}

// ─── ACTIVITIES ──────────────────────────────────────

export function ActivityPainting(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#FF8A80" />
      <ellipse cx="38" cy="42" rx="18" ry="14" fill="white" transform="rotate(-10 38 42)" />
      <circle cx="28" cy="38" r="3.5" fill="#FFD54F" />
      <circle cx="36" cy="32" r="3.5" fill="#42A5F5" />
      <circle cx="46" cy="36" r="3.5" fill="#66BB6A" />
      <circle cx="34" cy="48" r="3.5" fill="#AB47BC" />
      <circle cx="44" cy="46" r="4" fill="#FF8A80" />
    </I>
  );
}

export function ActivityReading(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#4DB6AC" />
      <rect x="18" y="28" width="20" height="26" rx="2" fill="white" transform="rotate(-5 28 41)" />
      <rect x="42" y="28" width="20" height="26" rx="2" fill="white" transform="rotate(5 52 41)" />
      <line x1="40" y1="26" x2="40" y2="56" stroke="#B2DFDB" strokeWidth="2" />
      <line x1="23" y1="35" x2="34" y2="34" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="40" x2="34" y2="39" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="45" x2="34" y2="44" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="34" x2="57" y2="35" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="39" x2="57" y2="40" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="44" x2="57" y2="45" stroke="#B2DFDB" strokeWidth="1.5" strokeLinecap="round" />
    </I>
  );
}

export function ActivitySport(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#FFB74D" />
      <circle cx="40" cy="40" r="16" fill="white" />
      <path d="M40 24 Q48 40 40 56" stroke="#FFB74D" strokeWidth="2.5" />
      <path d="M40 24 Q32 40 40 56" stroke="#FFB74D" strokeWidth="2.5" />
      <line x1="24" y1="40" x2="56" y2="40" stroke="#FFB74D" strokeWidth="2" />
    </I>
  );
}

export function ActivityMusic(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#B39DDB" />
      <circle cx="28" cy="52" r="6" fill="white" />
      <line x1="34" y1="52" x2="34" y2="24" stroke="white" strokeWidth="3" />
      <circle cx="50" cy="48" r="6" fill="white" />
      <line x1="56" y1="48" x2="56" y2="20" stroke="white" strokeWidth="3" />
      <line x1="34" y1="24" x2="56" y2="20" stroke="white" strokeWidth="3" />
    </I>
  );
}

export function ActivityPuzzle(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#81C784" />
      <rect x="24" y="24" width="32" height="32" rx="5" fill="white" />
      <circle cx="32" cy="32" r="3" fill="#81C784" />
      <circle cx="48" cy="32" r="3" fill="#81C784" />
      <circle cx="40" cy="40" r="3" fill="#81C784" />
      <circle cx="32" cy="48" r="3" fill="#81C784" />
      <circle cx="48" cy="48" r="3" fill="#81C784" />
    </I>
  );
}

export function ActivityPark(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#66BB6A" />
      <rect x="37" y="48" width="6" height="14" rx="2" fill="#8D6E63" />
      <circle cx="40" cy="34" r="16" fill="white" />
      <circle cx="28" cy="42" r="10" fill="white" />
      <circle cx="52" cy="42" r="10" fill="white" />
    </I>
  );
}

export function ActivityCooking(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#F48FB1" />
      <path d="M26 50 L30 62 h20 L54 50 Z" fill="white" />
      <circle cx="32" cy="44" r="8" fill="white" />
      <circle cx="40" cy="38" r="9" fill="white" />
      <circle cx="48" cy="44" r="8" fill="white" />
      <circle cx="40" cy="30" r="4" fill="#EF5350" />
      <path d="M40 26 Q45 22 47 25" stroke="#66BB6A" strokeWidth="2" strokeLinecap="round" />
    </I>
  );
}

export function ActivitySwimming(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#4FC3F7" />
      <g className="kids-waves">
        <path d="M14 34 Q22 28 30 34 Q38 40 46 34 Q54 28 62 34" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 46 Q22 40 30 46 Q38 52 46 46 Q54 40 62 46" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 58 Q22 52 30 58 Q38 64 46 58 Q54 52 62 58" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      </g>
    </I>
  );
}

export function ActivityFriends(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#FFB74D" />
      <circle cx="30" cy="30" r="8" fill="white" />
      <path d="M18 56 Q18 42 30 42 Q42 42 42 56" fill="white" />
      <circle cx="50" cy="30" r="8" fill="white" />
      <path d="M38 56 Q38 42 50 42 Q62 42 62 56" fill="white" />
    </I>
  );
}

export function ActivityCrafts(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#7986CB" />
      <circle cx="30" cy="28" r="7" fill="none" stroke="white" strokeWidth="3" />
      <circle cx="50" cy="28" r="7" fill="none" stroke="white" strokeWidth="3" />
      <line x1="34" y1="34" x2="52" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <line x1="46" y1="34" x2="28" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="44" r="2.5" fill="#7986CB" stroke="white" strokeWidth="1.5" />
    </I>
  );
}

export function ActivityAnimals(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#A1887F" />
      <ellipse cx="40" cy="50" rx="11" ry="9" fill="white" />
      <ellipse cx="26" cy="34" rx="5" ry="6.5" fill="white" transform="rotate(-15 26 34)" />
      <ellipse cx="36" cy="27" rx="5" ry="6.5" fill="white" transform="rotate(-5 36 27)" />
      <ellipse cx="46" cy="27" rx="5" ry="6.5" fill="white" transform="rotate(5 46 27)" />
      <ellipse cx="56" cy="34" rx="5" ry="6.5" fill="white" transform="rotate(15 56 34)" />
    </I>
  );
}

export function ActivityDressup(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="40" cy="40" r="34" fill="#CE93D8" />
      <path d="M18 52 L18 34 L28 42 L40 28 L52 42 L62 34 L62 52 Z" fill="white" />
      <circle cx="28" cy="46" r="2.5" fill="#FFD54F" />
      <circle cx="40" cy="46" r="2.5" fill="#EF5350" />
      <circle cx="52" cy="46" r="2.5" fill="#42A5F5" />
    </I>
  );
}

// ─── OPTION ARRAYS ───────────────────────────────────

export const WEATHER_OPTIONS = [
  { id: "sunny", Icon: WeatherSunny },
  { id: "partly-cloudy", Icon: WeatherPartlyCloudy },
  { id: "cloudy", Icon: WeatherCloudy },
  { id: "rainy", Icon: WeatherRainy },
  { id: "stormy", Icon: WeatherStormy },
  { id: "snowy", Icon: WeatherSnowy },
] as const;

export const MOOD_OPTIONS = [
  { id: "very-happy", Icon: MoodVeryHappy },
  { id: "happy", Icon: MoodHappy },
  { id: "neutral", Icon: MoodNeutral },
  { id: "sad", Icon: MoodSad },
  { id: "angry", Icon: MoodAngry },
] as const;

export const ACTIVITY_OPTIONS = [
  { id: "painting", Icon: ActivityPainting },
  { id: "reading", Icon: ActivityReading },
  { id: "sport", Icon: ActivitySport },
  { id: "music", Icon: ActivityMusic },
  { id: "puzzle", Icon: ActivityPuzzle },
  { id: "park", Icon: ActivityPark },
  { id: "cooking", Icon: ActivityCooking },
  { id: "swimming", Icon: ActivitySwimming },
  { id: "friends", Icon: ActivityFriends },
  { id: "crafts", Icon: ActivityCrafts },
  { id: "animals", Icon: ActivityAnimals },
  { id: "dressup", Icon: ActivityDressup },
] as const;
