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

const FALLBACK_COPY = {
  [WATER_TYPE.PAID]: {
    title: 'Платные водоёмы',
    desc: 'Водоёмы Пермского края с оплатой за рыбалку: пруды, хозяйства и специализированные места.',
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
  const pageKey = waterType === WATER_TYPE.PAID ? CMS_PAGES.PAID_WATERS : CMS_PAGES.FREE_WATERS;
  const { data: cmsPage } = useCmsPage(pageKey);
  const fallback = FALLBACK_COPY[waterType];

  const copy = {
    title: cmsPage?.title || fallback.title,
    desc: cmsPage?.description || fallback.desc,
    intro: cmsPage?.intro || '',
    countLabel: fallback.countLabel,
  };

  const isPaid = waterType === WATER_TYPE.PAID;
  const Card = isPaid ? PaidWaterCard : FreeWaterCard;

  return (
    <div className={`water-catalog-page water-catalog-page--${isPaid ? 'paid' : 'free'}`}>
      <header className="water-catalog-page__head section-inner">
        <WaterTypeSwitch />
        <div className="water-catalog-page__intro">
          <h1>{copy.title}</h1>
          <p className="water-catalog-page__desc">{copy.desc}</p>
          {copy.intro ? <p className="water-catalog-page__desc">{copy.intro}</p> : null}
        </div>
        <div className="water-catalog-page__toolbar">
          <p className="water-catalog-page__count">
            {catalog.loading ? 'Загрузка…' : copy.countLabel(catalog.filtered.length)}
          </p>
          <div className="water-catalog-page__view-toggle" role="tablist">
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
      </header>

      <div className="section-inner water-catalog-page__body">
        <WaterFilterPanel
          isPaid={isPaid}
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
