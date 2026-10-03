import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiDataEnabled } from '../lib/apiClient';
import './FishermenRankingPage.css';

function formatMoney(n) {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FishermenRankingPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [contests, setContests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!apiDataEnabled) throw new Error('API выключен');
        const [ranking, list] = await Promise.all([
          api.get(`/api/contests/ranking?month=${month}`),
          api.get('/api/contests'),
        ]);
        if (!alive) return;
        setData(ranking);
        setContests((list || []).filter((c) => c.type === 'monthly_activity' || c.type === 'reports'));
      } catch (err) {
        if (alive) setError(err.message || 'Ошибка загрузки');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  const activeMonthly = contests.find(
    (c) => c.type === 'monthly_activity' && c.status === 'active'
  );

  return (
    <div className="ranking-page">
      <header className="ranking-page__head">
        <p className="ranking-page__eyebrow">Сообщество</p>
        <h1>Рейтинг рыбаков Пермского края</h1>
        <p className="ranking-page__lead">
          Места считаются по одобренным отзывам и комментариям за месяц. Призовые 1–3 места
          начисляются на баланс в личном кабинете после окончания розыгрыша.
        </p>
        <div className="ranking-page__controls">
          <label>
            Месяц
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <Link to="/cabinet/balance" className="ranking-page__link">
            Мой баланс →
          </Link>
          <Link to="/reports" className="ranking-page__link">
            Отчёты →
          </Link>
        </div>
      </header>

      {activeMonthly && (
        <section className="ranking-page__prize">
          <h2>{activeMonthly.title}</h2>
          <p>{activeMonthly.description || 'Месячный розыгрыш за активность'}</p>
          <ul>
            {(activeMonthly.prizes || []).map((p) => (
              <li key={p.place}>
                {p.place} место — <strong>{formatMoney(p.amount_rub)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="ranking-page__error">{error}</p>}
      {loading ? (
        <p className="ranking-page__muted">Загрузка…</p>
      ) : (
        <ol className="ranking-page__list">
          {(data?.ranking || []).length === 0 && (
            <li className="ranking-page__empty">Пока нет данных за этот месяц</li>
          )}
          {(data?.ranking || []).map((row, i) => (
            <li key={row.user_id} className={i < 3 ? `is-top is-top-${i + 1}` : ''}>
              <span className="ranking-page__place">{i + 1}</span>
              <div className="ranking-page__who">
                <Link to={`/u/${row.user_id}`}>{row.display_name || 'Рыболов'}</Link>
                <span>
                  отзывы {row.reviews || 0} · комментарии {row.comments || 0}
                  {(row.base_reviews || 0) > 0 ? ` · отзывы о базах ${row.base_reviews}` : ''}
                </span>
              </div>
              <strong className="ranking-page__score">{Number(row.score) || 0}</strong>
            </li>
          ))}
        </ol>
      )}

      {contests.filter((c) => c.type === 'reports' && c.status === 'active').length > 0 && (
        <section className="ranking-page__reports">
          <h2>Конкурсы отчётов</h2>
          <ul>
            {contests
              .filter((c) => c.type === 'reports' && c.status === 'active')
              .map((c) => (
                <li key={c.id}>
                  <strong>{c.title}</strong>
                  <span>
                    Призы:{' '}
                    {(c.prizes || [])
                      .map((p) => `${p.place} — ${formatMoney(p.amount_rub)}`)
                      .join(', ')}
                  </span>
                  <Link to="/reports">Участвовать отчётом →</Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
