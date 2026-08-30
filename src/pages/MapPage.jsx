import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { basesService } from '../services/basesService';
import { catalogStats } from '../lib/catalogSeed';
import './MapPage.css';

const FILTER_OPTIONS = [
  { id: 'all', label: 'Все', icon: '🗺️' },
  { id: 'paid', label: 'Платные', icon: '💎' },
  { id: 'free', label: 'Бесплатные', icon: '🌲' },
];

export default function MapPage() {
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const ymapsRef = useRef(null);

  const stats = useMemo(() => {
    const paid = places.filter((p) => p.type === 'paid').length;
    const free = places.filter((p) => p.type === 'free').length;
    if (places.length) return { total: places.length, paid, free };
    return catalogStats();
  }, [places]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    basesService
      .listPublic()
      .then((rows) => {
        if (!alive) return;
        setPlaces(
          (rows || []).map((base) => ({
            ...base,
            icon: base.type === 'free' ? '🌲' : '💎',
          }))
        );
      })
      .catch(() => {
        if (alive) setPlaces([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredPlaces = useMemo(() => {
    if (filter === 'all') return places;
    return places.filter((place) => place.type === filter);
  }, [places, filter]);

  useEffect(() => {
    if (window.ymaps) {
      ymapsRef.current = window.ymaps;
      setMapLoaded(true);
      return undefined;
    }

    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    if (!apiKey || String(apiKey).includes('YOUR_YANDEX')) {
      setMapError(true);
      return undefined;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => {
        ymapsRef.current = window.ymaps;
        setMapLoaded(true);
      });
    };
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const buildBalloon = useCallback((place) => {
    const name = escapeHtml(place.name);
    const short = escapeHtml(place.short || '');
    const price = escapeHtml(place.price || '');
    const fish = escapeHtml(place.fish || '');
    const isFree = place.type === 'free';
    const img = place.images?.[0]
      ? `<div class="ym-balloon__media"><img src="${escapeHtml(place.images[0])}" alt="" /></div>`
      : `<div class="ym-balloon__media ym-balloon__media--empty"><span>${isFree ? '🌲' : '💎'}</span></div>`;

    return `
      <div class="ym-balloon">
        ${img}
        <div class="ym-balloon__body">
          <span class="ym-balloon__badge ym-balloon__badge--${isFree ? 'free' : 'paid'}">
            ${isFree ? 'Бесплатно' : 'Платный'}
          </span>
          <strong class="ym-balloon__title">${name}</strong>
          ${short ? `<p class="ym-balloon__text">${short}</p>` : ''}
          <div class="ym-balloon__meta">
            ${price ? `<span class="ym-balloon__price">${price}</span>` : ''}
            ${fish ? `<span class="ym-balloon__fish"><span aria-hidden="true">🐟</span>${fish}</span>` : ''}
          </div>
          <a href="/waters/${escapeHtml(place.id)}" class="ym-balloon__cta">Подробнее</a>
        </div>
      </div>
    `;
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapError) return undefined;

    const ymaps = ymapsRef.current;
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

    const BalloonLayout = ymaps.templateLayoutFactory.createClass(
      `<div class="ym-balloon-shell">
        <button type="button" class="ym-balloon-shell__close" aria-label="Закрыть">×</button>
        <div class="ym-balloon-shell__inner">$[[options.contentLayout observeSize]]</div>
        <div class="ym-balloon-shell__tail"></div>
      </div>`,
      {
        build() {
          BalloonLayout.superclass.build.call(this);
          this._$element = this.getParentElement().querySelector('.ym-balloon-shell');
          this._closeBtn = this._$element.querySelector('.ym-balloon-shell__close');
          this._onCloseClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.events.fire('userclose');
          };
          this._closeBtn.addEventListener('click', this._onCloseClick);
          this.applyElementOffset();
        },
        clear() {
          if (this._closeBtn) {
            this._closeBtn.removeEventListener('click', this._onCloseClick);
          }
          BalloonLayout.superclass.clear.call(this);
        },
        onSublayoutSizeChange() {
          BalloonLayout.superclass.onSublayoutSizeChange.apply(this, arguments);
          if (!this._isElement(this._$element)) return;
          this.applyElementOffset();
          this.events.fire('shapechange');
        },
        applyElementOffset() {
          if (!this._isElement(this._$element)) return;
          const el = this._$element;
          el.style.left = `${-(el.offsetWidth / 2)}px`;
          el.style.top = `${-(el.offsetHeight + 14)}px`;
        },
        getShape() {
          if (!this._isElement(this._$element)) return BalloonLayout.superclass.getShape.call(this);
          const el = this._$element;
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          return new ymaps.shape.Rectangle(
            new ymaps.geometry.pixel.Rectangle([[-w / 2, -(h + 14)], [w / 2, 0]])
          );
        },
        _isElement(el) {
          return Boolean(el && el.nodeType === 1);
        },
      }
    );

    const BalloonContentLayout = ymaps.templateLayoutFactory.createClass('$[properties.balloonContent]');

    filteredPlaces.forEach((place) => {
      const coords = place.coords?.split(',').map((c) => parseFloat(c.trim()));
      if (!coords || coords.length !== 2 || Number.isNaN(coords[0]) || Number.isNaN(coords[1])) {
        return;
      }

      const placemark = new ymaps.Placemark(
        coords,
        {
          balloonContent: buildBalloon(place),
          hintContent: place.name,
        },
        {
          preset:
            place.type === 'paid' ? 'islands#blueCircleDotIcon' : 'islands#greenCircleDotIcon',
          balloonShadow: false,
          balloonLayout: BalloonLayout,
          balloonContentLayout: BalloonContentLayout,
          balloonPanelMaxMapArea: 0,
          hideIconOnBalloonOpen: false,
          openBalloonOnClick: true,
        }
      );

      placemark.events.add('click', () => setSelectedItem(place));
      map.geoObjects.add(placemark);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded, filteredPlaces, mapError, buildBalloon]);

  const closeSidebar = () => setSelectedItem(null);

  return (
    <div className="map-page">
      <header className="map-hero">
        <div className="map-hero__inner section-inner">
          <span className="map-hero__eyebrow">Пермский край</span>
          <h1>Карта водоёмов</h1>
          <p>Платные базы и бесплатные места для рыбалки на одной карте</p>

          <div className="map-stats">
            <div className="map-stat">
              <span className="map-stat__value">{stats.total}</span>
              <span className="map-stat__label">всего</span>
            </div>
            <div className="map-stat map-stat--paid">
              <span className="map-stat__value">{stats.paid}</span>
              <span className="map-stat__label">платных</span>
            </div>
            <div className="map-stat map-stat--free">
              <span className="map-stat__value">{stats.free}</span>
              <span className="map-stat__label">бесплатных</span>
            </div>
          </div>

          <div className="map-filters" role="tablist" aria-label="Фильтр водоёмов">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={filter === opt.id}
                className={`map-filter ${filter === opt.id ? 'is-active' : ''}`}
                onClick={() => {
                  setFilter(opt.id);
                  setSelectedItem(null);
                }}
              >
                <span className="map-filter__icon" aria-hidden>
                  {opt.icon}
                </span>
                {opt.label}
                <span className="map-filter__count">
                  {opt.id === 'all' ? stats.total : opt.id === 'paid' ? stats.paid : stats.free}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="map-body section-inner">
        <div className="map-frame">
          {loading && (
            <div className="map-loading">
              <div className="map-loading__spinner" />
              <p>Загрузка водоёмов…</p>
            </div>
          )}

          {!loading && !filteredPlaces.length && !mapError && (
            <div className="map-empty">
              <span className="map-empty__icon">🗺️</span>
              <p className="map-empty__title">Нет водоёмов для отображения</p>
              <p className="map-empty__text">Попробуйте другой фильтр или зайдите позже</p>
            </div>
          )}

          {mapError && (
            <div className="map-fallback">
              <span className="map-fallback__icon">📍</span>
              <p className="map-fallback__title">Карта недоступна</p>
              <p className="map-fallback__hint">
                Укажите <code>VITE_YANDEX_MAPS_API_KEY</code> в файле <code>.env</code>
              </p>
              {filteredPlaces.length > 0 && (
                <ul className="map-fallback__list">
                  {filteredPlaces.map((p) => (
                    <li key={p.id}>
                      <Link to={`/waters/${p.id}`}>{p.name}</Link>
                      <span>{p.address}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!mapError && (
            <>
              <div className="map-legend">
                <span className="map-legend__item">
                  <i className="map-legend__dot map-legend__dot--paid" />
                  Платные
                </span>
                <span className="map-legend__item">
                  <i className="map-legend__dot map-legend__dot--free" />
                  Бесплатные
                </span>
              </div>
              <div ref={mapRef} className="map-canvas" />
            </>
          )}
        </div>
      </div>

      {selectedItem && (
        <button
          type="button"
          className="map-sidebar-scrim"
          aria-label="Закрыть карточку"
          onClick={closeSidebar}
        />
      )}

      {selectedItem && (
        <aside className="map-sidebar" aria-label="Информация о водоёме">
          <button
            type="button"
            className="map-sidebar__close"
            onClick={closeSidebar}
            aria-label="Закрыть"
          >
            ✕
          </button>

          <div className="map-sidebar__content">
            {selectedItem.images?.[0] && (
              <div className="map-sidebar__cover">
                <img src={selectedItem.images[0]} alt="" />
                <span
                  className={`map-sidebar__badge map-sidebar__badge--${selectedItem.type === 'free' ? 'free' : 'paid'}`}
                >
                  {selectedItem.type === 'free' ? 'Бесплатно' : 'Платный'}
                </span>
              </div>
            )}

            <div className="map-sidebar__body">
              {!selectedItem.images?.[0] && (
                <span
                  className={`map-sidebar__badge map-sidebar__badge--${selectedItem.type === 'free' ? 'free' : 'paid'}`}
                >
                  {selectedItem.type === 'free' ? 'Бесплатно' : 'Платный'}
                </span>
              )}

              <h2 className="map-sidebar__title">
                <span aria-hidden>{selectedItem.icon}</span>
                {selectedItem.name}
              </h2>

              {selectedItem.short && <p className="map-sidebar__desc">{selectedItem.short}</p>}

              {selectedItem.price && (
                <div className="map-sidebar__price">{selectedItem.price}</div>
              )}

              <dl className="map-sidebar__meta">
                {selectedItem.fish && (
                  <>
                    <dt>Рыба</dt>
                    <dd>{selectedItem.fish}</dd>
                  </>
                )}
                {selectedItem.address && (
                  <>
                    <dt>Адрес</dt>
                    <dd>{selectedItem.address}</dd>
                  </>
                )}
                {selectedItem.region && (
                  <>
                    <dt>Регион</dt>
                    <dd>{selectedItem.region}</dd>
                  </>
                )}
              </dl>

              <Link
                to={`/waters/${selectedItem.id}`}
                className="btn btn--primary map-sidebar__cta"
                onClick={closeSidebar}
              >
                Подробнее о водоёме
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
