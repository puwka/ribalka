import { useState } from 'react';
import { WATER_TYPE } from '../../lib/waterUtils';
import { CMS_PAGES } from '../../services/cmsService';
import { useCmsPage } from '../../hooks/useCms';
import { useWaterCatalog } from '../../hooks/useWaterCatalog';
import WaterTypeSwitch from './WaterTypeSwitch';
import WaterFilterPanel from './WaterFilterPanel';
import WaterMapView from './WaterMapView';
import {
  PaidWaterCard,
  FreeWaterCard,
  WaterCardGridSkeleton,
} from './WaterCard';
import './WaterCatalogPage.css';

const HERO_IMAGES = {
  [WATER_TYPE.PAID]: '/img/details/detail-sunset.jpg',
  [WATER_TYPE.PAID_FISHING]: '/img/details/detail-sunset.jpg',
  [WATER_TYPE.FREE]: '/img/details/detail-forest.jpg',
};

const FALLBACK_COPY = {
  [WATER_TYPE.PAID]: {
    title: 'Платные базы',
    desc: 'Базы отдыха с размещением и сервисом в Пермском крае.',
    countLabel: (n) => `${n} ${n === 1 ? 'объект' : n < 5 ? 'объекта' : 'объектов'}`,
  },
  [WATER_TYPE.PAID_FISHING]: {
    title: 'Платная рыбалка',
    desc: 'Водоёмы с платной рыбалкой в Пермском крае: цены, условия и карта.',
    countLabel: (n) => `${n} ${n === 1 ? 'объект' : n < 5 ? 'объекта' : 'объектов'}`,
  },
  [WATER_TYPE.FREE]: {
    title: 'Бесплатные водоёмы',
    desc: 'Реки, озёра и дикие места Прикамья без платы за въезд или сутки.',
    countLabel: (n) => `${n} ${n === 1 ? 'объект' : n < 5 ? 'объекта' : 'объектов'}`,
  },
};

export default function WaterCatalogPage({ waterType }) {
  const [viewMode, setViewMode] = useState('list');
  const catalog = useWaterCatalog(waterType);
  const pageKey =
    waterType === WATER_TYPE.PAID
      ? CMS_PAGES.PAID_WATERS
      : waterType === WATER_TYPE.PAID_FISHING
        ? CMS_PAGES.PAID_FISHING
        : CMS_PAGES.FREE_WATERS;
  const { data: cmsPage } = useCmsPage(pageKey);
  const fallback = FALLBACK_COPY[waterType];

  const copy = {
    title: cmsPage?.title || fallback.title,
    desc: cmsPage?.description || fallback.desc,
    intro: cmsPage?.intro || '',
    countLabel: fallback.countLabel,
  };

  const isCommercial =
    waterType === WATER_TYPE.PAID || waterType === WATER_TYPE.PAID_FISHING;
  const Card = isCommercial ? PaidWaterCard : FreeWaterCard;
  const skin = waterType === WATER_TYPE.FREE ? 'free' : 'paid';

  return (
    <div className={`water-catalog-page water-catalog-page--${skin}`}>
      <header className="catalog-hero">
        <div
          className="catalog-hero__bg"
          style={{ backgroundImage: `url(${HERO_IMAGES[waterType] || HERO_IMAGES[WATER_TYPE.PAID]})` }}
          aria-hidden="true"
        />
        <div className="catalog-hero__shade" aria-hidden="true" />
        <div className="catalog-hero__inner section-inner">
          <WaterTypeSwitch />
          <div className="catalog-hero__copy">
            <p className="catalog-hero__eyebrow">Рыбалка в Прикамье · Пермский край</p>
            <h1>{copy.title}</h1>
            <p className="catalog-hero__desc">{copy.desc}</p>
            {copy.intro ? <p className="catalog-hero__desc">{copy.intro}</p> : null}
          </div>
          <div className="catalog-hero__bottom">
            <span className="catalog-hero__count">
              {catalog.loading ? 'Загрузка…' : copy.countLabel(catalog.filtered.length)}
            </span>
          </div>
        </div>
      </header>

      <div className="catalog-sheet section-inner">
        <div className="catalog-sheet__toolbar">
          <p className="catalog-sheet__hint">
            <span aria-hidden="true">🧭</span> Найдите базу или место по карте и фильтрам
          </p>
          <div className="water-catalog-page__view-toggle" role="tablist" aria-label="Вид каталога">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              className={viewMode === 'list' ? 'is-active' : ''}
              onClick={() => setViewMode('list')}
            >
              Список
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'map'}
              className={viewMode === 'map' ? 'is-active' : ''}
              onClick={() => setViewMode('map')}
            >
              Карта
            </button>
          </div>
        </div>

        <WaterFilterPanel
          isPaid={isCommercial}
          query={catalog.query}
          onQueryChange={catalog.setQuery}
          filters={catalog.filters}
          onFiltersChange={catalog.setFilters}
          sortBy={catalog.sortBy}
          onSortChange={catalog.setSortBy}
          regions={catalog.regions}
          kinds={catalog.kinds}
          onReset={catalog.resetFilters}
          hasActiveFilters={catalog.hasActiveFilters}
        />

        {catalog.loading && <WaterCardGridSkeleton count={8} />}

        {catalog.error && (
          <div className="state-block">
            <p className="state-block__title">Ошибка загрузки</p>
            <p className="state-block__text">{catalog.error.message}</p>
          </div>
        )}

        {!catalog.loading && !catalog.filtered.length && (
          <div className="state-block">
            <p className="state-block__title">Нет водоёмов по выбранным параметрам</p>
            <p className="state-block__text">Измените фильтры или сбросьте поиск.</p>
            {catalog.hasActiveFilters && (
              <button type="button" className="btn btn--primary" onClick={catalog.resetFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        {!catalog.loading && viewMode === 'map' && catalog.filtered.length > 0 && (
          <WaterMapView items={catalog.filtered} />
        )}

        {!catalog.loading && viewMode === 'list' && catalog.filtered.length > 0 && (
          <div className="water-catalog__grid">
            {catalog.filtered.map((item) => (
              <Card key={item.id} item={item} layout="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
