import { Link } from 'react-router-dom';
import { useFreePlaces } from '../../hooks/useFreePlaces';
import BaseCard, { BaseCardGridSkeleton } from '../BaseCard/BaseCard';
import './FreePlaces.css';

export default function FreePlaces() {
  const { data: freePlaces, loading, error } = useFreePlaces();

  return (
    <section className="free page-section page-section--alt" id="free">
      <div className="section-inner">
        <header className="section-head">
          <span className="section-head__eyebrow">Природа</span>
          <h2 className="section-head__title">Бесплатные места для рыбалки</h2>
          <p className="section-head__desc">
            Реки, озёра и дикие уголки Прикамья без платы за въезд
          </p>
        </header>

        {loading && <BaseCardGridSkeleton count={3} />}

        {error && (
          <div className="state-block">
            <p className="state-block__title">Не удалось загрузить места</p>
          </div>
        )}

        {!loading && !error && !freePlaces.length && (
          <div className="state-block">
            <p className="state-block__title">Пока нет опубликованных мест</p>
          </div>
        )}

        {!loading && freePlaces.length > 0 && (
          <>
            <div className="free__grid">
              {freePlaces.map((place) => (
                <BaseCard key={place.id} item={place} />
              ))}
            </div>
            <div className="free__show-more">
              <Link to="/free-waters" className="btn btn--ghost">
                Все бесплатные места ({freePlaces.length}) →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
