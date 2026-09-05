import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toYandexCoords } from '../../lib/coords';
import './WaterMapView.css';

export default function WaterMapView({ items }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return undefined;

    const initMap = (ymaps) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }

      const map = new ymaps.Map(mapRef.current, {
        center: [58.0, 56.0],
        zoom: 7,
        controls: ['zoomControl', 'fullscreenControl'],
      });
      mapInstanceRef.current = map;

      items.forEach((place) => {
        const coords = toYandexCoords(place);
        if (!coords) return;

        const placemark = new ymaps.Placemark(
          coords,
          {
            balloonContent: `
              <div style="max-width:240px;font-family:Rubik,sans-serif;">
                <strong>${place.name}</strong>
                <p style="font-size:0.85rem;color:#64748b;margin:6px 0;">${place.short || ''}</p>
                <a href="/waters/${place.id}" style="color:#2563eb;font-weight:600;">Подробнее →</a>
              </div>
            `,
            hintContent: place.name,
          },
          {
            preset:
              place.type === 'paid' ? 'islands#blueCircleDotIcon' : 'islands#greenCircleDotIcon',
          }
        );
        map.geoObjects.add(placemark);
      });
    };

    if (window.ymaps) {
      window.ymaps.ready(() => initMap(window.ymaps));
      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy();
          mapInstanceRef.current = null;
        }
      };
    }

    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    if (!apiKey || String(apiKey).includes('YOUR_YANDEX')) {
      return undefined;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => initMap(window.ymaps));
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [items]);

  const apiMissing =
    !window.ymaps &&
    (!import.meta.env.VITE_YANDEX_MAPS_API_KEY ||
      String(import.meta.env.VITE_YANDEX_MAPS_API_KEY).includes('YOUR_YANDEX'));

  if (apiMissing && items.length) {
    return (
      <div className="water-map-fallback">
        <p>Карта недоступна без API-ключа Яндекс.Карт.</p>
        <ul>
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/waters/${p.id}`}>{p.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <div ref={mapRef} className="water-map-view" role="application" aria-label="Карта водоёмов" />;
}
