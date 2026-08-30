import { Link } from 'react-router-dom';
import { usePaidBases } from '../../hooks/usePaidBases';
import { useFreePlaces } from '../../hooks/useFreePlaces';
import {
  PaidWaterCard,
  FreeWaterCard,
  WaterCardGridSkeleton,
  WaterCardListSkeleton,
} from '../waters/WaterCard';
import './WatersHomeSection.css';

export default function WatersHomeSection() {
  const { data: paid, loading: loadingPaid } = usePaidBases();
  const { data: free, loading: loadingFree } = useFreePlaces();

  return (
    <section className="waters-home page-section page-section--alt" id="waters">
      <div className="section-inner">
        <header className="section-head">
          <h2 className="section-head__title">Водоёмы Прикамья</h2>
          <p className="section-head__desc">
            Платные водоёмы и бесплатные места — отдельные каталоги с картой и фильтрами
          </p>
        </header>

        <div className="waters-home__paid">
          <div className="waters-home__head">
            <h3>Платные водоёмы</h3>
            <Link to="/paid-waters" className="btn btn--ghost">
              Все платные
            </Link>
          </div>
          {loadingPaid ? (
            <WaterCardGridSkeleton count={3} />
          ) : (
            <div className="waters-home__grid">
              {paid.slice(0, 3).map((item) => (
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
            <WaterCardListSkeleton count={3} />
          ) : (
            <div className="waters-home__list">
              {free.map((item) => (
                <FreeWaterCard key={item.id} item={item} layout="row" />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
