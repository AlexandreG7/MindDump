import "./landing.css";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Chaos, Marquee } from "./Story";
import { Scenes } from "./Scenes";
import { Bento } from "./Bento";
import { Closing } from "./Closing";
import { LandingMotion } from "./LandingMotion";

/**
 * Landing v2 : rendue côté serveur (tout le texte est dans le HTML). Seuls
 * LandingMotion (scroll, GSAP, Lenis chargés en différé) et SpotlightCard sont
 * des composants client. Le conteneur est fixe parce que le layout de l'app
 * enferme `main` dans un viewport à hauteur fixe : la landing défile dans son
 * propre élément, d'où `data-lp-root` pour GSAP et Lenis.
 */
export function Landing() {
  return (
    <>
      <div className="lp2" data-lp-root>
        <div className="lp2-content">
          <Header />
          {/* Pas de <main> : le layout de l'app en fournit déjà un. */}
          <div>
            <Hero />
            <Marquee />
            <Chaos />
            <Scenes />
            <Bento />
            <Closing />
          </div>
        </div>
      </div>
      <LandingMotion />
    </>
  );
}
