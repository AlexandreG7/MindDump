/**
 * Animation d'ouverture de l'app (coque Capacitor), jouée une seule fois par
 * lancement à froid. Le site web et la PWA n'affichent jamais rien.
 *
 * Première image : identique à l'écran de lancement natif (voir
 * docs/app-intro.md) pour que le passage natif -> web ne fasse ni flash ni
 * saut. La suite est du CSS pur (globals.css, `.app-intro*`) : elle se termine
 * et disparaît même si le JavaScript tarde ou échoue.
 */

/** Même fond que le colorset iOS `AppBackground` (clair / sombre). */
export const APP_INTRO_COLORS = {
  light: "#F8F7F5",
  dark: "#212226",
  logo: "#F97316",
} as const;

/** Côté du logo en points / px CSS, centré dans l'écran (écran natif identique). */
export const APP_INTRO_LOGO_SIZE = 96;

/** Filet de sécurité : l'overlay est retiré du DOM au plus tard après ce délai. */
export const APP_INTRO_MAX_MS = 2500;

export const APP_INTRO_ATTRIBUTE = "data-app-intro";
export const APP_INTRO_SESSION_KEY = "minddump-app-intro";

/**
 * Script inline (<head>) : dans l'app, au premier chargement de la session et
 * hors écrans sans intro (mur, mode enfant, page hors ligne), arme l'overlay
 * avant le premier rendu. sessionStorage est vidé quand l'app est tuée : un
 * rechargement ou un retour au premier plan dans la même session ne rejoue pas.
 */
export const appIntroScript = `(function(){try{var d=document.documentElement;if(navigator.userAgent.indexOf("MindDumpApp/")===-1)return;if(/^\\/(wall|kids|hors-ligne)(\\/|$)/.test(location.pathname))return;if(sessionStorage.getItem("${APP_INTRO_SESSION_KEY}"))return;sessionStorage.setItem("${APP_INTRO_SESSION_KEY}","1");d.setAttribute("${APP_INTRO_ATTRIBUTE}","")}catch(e){}})();`;
