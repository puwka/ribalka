import { Link } from 'react-router-dom';
import { usePaidBases } from '../../hooks/usePaidBases';
import BaseCard, { BaseCardGridSkeleton } from '../BaseCard/BaseCard';
import './PaidBases.css';

export default function PaidBases() {
  const { data: paidBases, loading, error } = usePaidBases();
  const displayedBases = paidBases.slice(0, 6);

  return (
    <section className="paid page-section" id="paid">
      <div className="section-inner">
        <header className="section-head">
          <span className="section-head__eyebrow">Каталог</span>
          <h2 className="section-head__title">Платные водоёмы Пермского края</h2>
          <p className="section-head__desc">
            Базы с домиками, баней, прокатом снастей и сервисом для комфортной рыбалки
          </p>
        </header>

        {loading && <BaseCardGridSkeleton count={6} />}

        {error && (
          <div className="state-block">
            <p className="state-block__title">Не удалось загрузить каталог</p>
            <p className="state-block__text">{error.message}</p>
          </div>
        )}

        {!loading && !error && !paidBases.length && (
          <div className="state-block">
            <p className="state-block__title">Пока нет опубликованных баз</p>
            <p className="state-block__text">Владельцы могут подать заявку в личном кабинете.</p>
          </div>
        )}

        {!loading && paidBases.length > 0 && (
          <>
            <div className="paid__grid">
              {displayedBases.map((base) => (
                <BaseCard key={base.id} item={base} />
              ))}
            </div>
            {paidBases.length > 6 && (
              <div className="paid__show-more">
                <Link to="/paid-waters" className="btn btn--ghost">
                  Все платные водоёмы ({paidBases.length}) →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
