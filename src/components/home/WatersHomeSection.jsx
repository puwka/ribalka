import { Link } from 'react-router-dom';
import { usePaidBases } from '../../hooks/usePaidBases';
import { usePaidFishing } from '../../hooks/usePaidFishing';
import { useFreePlaces } from '../../hooks/useFreePlaces';
import {
  PaidWaterCard,
  FreeWaterCard,
  WaterCardGridSkeleton,
} from '../waters/WaterCard';
import { sortPromoFirst } from '../../lib/waterUtils';
import './WatersHomeSection.css';

export default function WatersHomeSection() {
  const { data: paid, loading: loadingPaid } = usePaidBases({ limit: 8 });
  const { data: fishing, loading: loadingFishing } = usePaidFishing({ limit: 8 });
  const { data: free, loading: loadingFree } = useFreePlaces({ limit: 8 });

  return (
    <section className="waters-home page-section page-section--alt" id="waters">
      <div className="section-inner">
        <header className="section-head">
          <h2 className="section-head__title">Водоёмы Прикамья</h2>
          <p className="section-head__desc">
            Платные базы, платная рыбалка и бесплатные места — отдельные каталоги с картой и
            фильтрами
          </p>
        </header>

        <div className="waters-home__paid">
          <div className="waters-home__head">
            <h3>Платные базы</h3>
            <Link to="/paid-waters" className="btn btn--ghost">
              Все базы
            </Link>
          </div>
          {loadingPaid ? (
            <WaterCardGridSkeleton count={4} />
          ) : (
            <div className="waters-home__grid">
              {sortPromoFirst(paid)
                .slice(0, 4)
                .map((item) => (
                  <PaidWaterCard key={item.id} item={item} />
                ))}
            </div>
          )}
        </div>

        <div className="waters-home__paid">
          <div className="waters-home__head">
            <h3>Платная рыбалка</h3>
            <Link to="/paid-fishing" className="btn btn--ghost">
              Все объекты
            </Link>
          </div>
          {loadingFishing ? (
            <WaterCardGridSkeleton count={4} />
          ) : (
            <div className="waters-home__grid">
              {sortPromoFirst(fishing)
                .slice(0, 4)
                .map((item) => (
                  <PaidWaterCard key={item.id} item={item} />
                ))}
            </div>
          )}
        </div>

        <div className="waters-home__free">
          <div className="waters-home__head">
            <h3>Бесплатные водоёмы</h3>
            <Link to="/free-waters" className="btn btn--ghost">
              Все бесплатные
            </Link>
          </div>
          {loadingFree ? (
            <WaterCardGridSkeleton count={4} />
          ) : (
            <div className="waters-home__grid">
              {sortPromoFirst(free)
                .slice(0, 4)
                .map((item) => (
                  <FreeWaterCard key={item.id} item={item} />
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
