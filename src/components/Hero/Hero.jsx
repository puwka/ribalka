import { Link } from 'react-router-dom';
import './Hero.css';

const HERO_IMG = '/img/hero/hero-main.jpg';

/**
 * Full-bleed hero matching the design mockup 1:1.
 * Artwork includes title, feature chips and painted CTAs;
 * real links sit as hotspots over the two buttons.
 */
export default function Hero() {
  return (
    <section className="hero" id="home" aria-label="Активный отдых и рыбалка в Пермском крае">
      <div className="hero__frame">
        <img
          className="hero__art"
          src={HERO_IMG}
          alt=""
          width={1776}
          height={896}
          fetchPriority="high"
          decoding="async"
        />

        <h1 className="visually-hidden">Активный отдых и рыбалка в Пермском крае</h1>

        <div className="hero__hits">
          <Link
            to="/paid-waters"
            className="hero__hit hero__hit--bases"
            aria-label="Базы отдыха"
          />
          <Link
            to="/free-waters"
            className="hero__hit hero__hit--fish"
            aria-label="Где порыбачить"
          />
        </div>
      </div>
    </section>
  );
}
