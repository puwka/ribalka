import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiDataEnabled } from '../../lib/apiClient';
import { advertisingService } from '../../services/advertisingService';
import { useAuth } from '../auth/AuthContext';
import './SideBannerRails.css';

const SLOTS_PER_SIDE = 2;
const seenImpressions = new Set();

function trackImpression(adId) {
  if (!adId || seenImpressions.has(adId)) return;
  seenImpressions.add(adId);
  advertisingService.recordImpression(adId);
}

function BannerCard({ ad }) {
  const href = ad.target_url || ad.targetUrl || '#';
  const src = ad.image_url || ad.imageUrl;
  const title = ad.title || 'Реклама';
  const ref = useRef(null);

  useEffect(() => {
    if (!ad?.id || !ref.current) return undefined;
    const node = ref.current;
    if (typeof IntersectionObserver === 'undefined') {
      trackImpression(ad.id);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)) {
          trackImpression(ad.id);
          io.disconnect();
        }
      },
      { threshold: [0.4] }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ad?.id]);

  if (!src) return null;

  return (
    <a
      ref={ref}
      className="side-banner"
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      title={title}
      onClick={() => advertisingService.recordClick(ad.id)}
    >
      <img src={src} alt={title} loading="lazy" width={200} height={300} />
    </a>
  );
}

function Rail({ side, items, placeHref, priceLabel, emptySlots }) {
  const list = (items || []).slice(0, SLOTS_PER_SIDE);
  const placeholders = Math.max(0, emptySlots ?? SLOTS_PER_SIDE - list.length);

  return (
    <aside className={`side-banner-rail side-banner-rail--${side}`} aria-label={`Реклама ${side}`}>
      {list.map((ad) => (
        <BannerCard key={ad.id} ad={ad} />
      ))}
      {Array.from({ length: placeholders }).map((_, i) => (
        <Link
          key={`ph-${side}-${i}`}
          to={placeHref}
          className="side-banner-rail__placeholder"
        >
          <span>Место для рекламы</span>
          <small>{priceLabel || '200×300 · разместить'}</small>
        </Link>
      ))}
    </aside>
  );
}

/**
 * Left/right sticky ad rails — 2 slots per side (4 total) for a given surface.
 * @param {'news'|'forum'} surface
 */
export default function SideBannerRails({ children, surface = 'news' }) {
  const { isAuthenticated } = useAuth();
  const [left, setLeft] = useState([]);
  const [right, setRight] = useState([]);
  const [priceLabel, setPriceLabel] = useState('300 ₽/сут');
  const placeHref = isAuthenticated
    ? `/cabinet/advertising?surface=${encodeURIComponent(surface)}`
    : '/register';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (apiDataEnabled) {
          const data = await api.get(
            `/api/ads/sidebar/public?surface=${encodeURIComponent(surface)}`
          );
          if (!alive) return;
          setLeft(data.left || []);
          setRight(data.right || []);
          if (data.price?.amount != null) {
            const unit = data.price.unit === 'month' ? 'мес' : 'сут';
            setPriceLabel(`${Number(data.price.amount).toLocaleString('ru-RU')} ₽/${unit}`);
          }
        } else {
          const active = await advertisingService.listActivePublic(surface);
          if (!alive) return;
          const sidebars = active.filter(
            (a) =>
              (a.ad_type === 'sidebar' || a.ad_type === 'banner') &&
              (a.surface || 'news') === surface
          );
          setLeft(sidebars.filter((a) => a.placement === 'left'));
          setRight(sidebars.filter((a) => a.placement !== 'left'));
        }
      } catch {
        if (alive) {
          setLeft([]);
          setRight([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [surface]);

  return (
    <div className="side-banner-layout">
      <Rail
        side="left"
        items={left}
        placeHref={placeHref}
        priceLabel={priceLabel}
        emptySlots={SLOTS_PER_SIDE - Math.min(left.length, SLOTS_PER_SIDE)}
      />
      <div className="side-banner-layout__main">{children}</div>
      <Rail
        side="right"
        items={right}
        placeHref={placeHref}
        priceLabel={priceLabel}
        emptySlots={SLOTS_PER_SIDE - Math.min(right.length, SLOTS_PER_SIDE)}
      />
    </div>
  );
}
