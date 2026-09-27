export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/**
 * Inlined in <head> so the right class is on <html> before first paint
 * (avoids a white flash when the dark theme is active).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

/**
 * Couleurs de la barre d'état (theme-color) et de l'écran de lancement PWA.
 * La barre prend la couleur du bandeau mobile (--card) pour s'y fondre.
 */
export const THEME_COLORS = {
  light: "#FFFFFF", // --card clair
  dark: "#2B2D31", // --card sombre
  background: "#F8F7F5", // --background clair
} as const;
