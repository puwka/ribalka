import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, apiDataEnabled } from '../lib/apiClient';
import './FishermenRankingPage.css';

function formatMoney(n) {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function typeLabel(type) {
  return type === 'reports'
    ? 'Конкурс отчётов об отдыхе'
    : 'Рейтинг за отзывы и комментарии';
}

function scoreHint(type, row) {
  if (type === 'reports') {
    return row.report_place
      ? `Отчёт: ${row.report_place} · голоса ${Number(row.score) || 0}`
      : `Голоса и реакции: ${Number(row.score) || 0}`;
  }
  return `Отзывы ${row.reviews || 0} · комментарии ${row.comments || 0}${
    (row.base_reviews || 0) > 0 ? ` · о базах ${row.base_reviews}` : ''
  }`;
}

function Avatar({ name, src, className = '' }) {
  const letter = String(name || '?').charAt(0).toUpperCase();
  if (src) {
    return <img className={`ranking-avatar ${className}`} src={src} alt="" />;
  }
  return (
    <div className={`ranking-avatar ranking-avatar--letter ${className}`} aria-hidden>
      {letter}
    </div>
  );
}

function StandingsList({ rows, contestType, emptyText }) {
  if (!rows?.length) {
    return <p className="ranking-page__muted">{emptyText}</p>;
  }
  return (
    <ol className="ranking-page__list">
      {rows.map((row, i) => {
        const place = Number(row.place) || i + 1;
        const name = row.display_name || 'Участник';
        const uid = row.user_id;
        return (
          <li key={uid || `${place}-${name}`} className={place <= 3 ? `is-top is-top-${place}` : ''}>
            <span className="ranking-page__place">{place}</span>
            <Avatar name={name} src={row.avatar_path} />
            <div className="ranking-page__who">
              {uid ? <Link to={`/u/${uid}`}>{name}</Link> : <strong>{name}</strong>}
              <span>{scoreHint(contestType, row)}</span>
            </div>
            <strong className="ranking-page__score">{Number(row.score) || 0}</strong>
          </li>
        );
      })}
    </ol>
  );
}

export default function FishermenRankingPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [standings, setStandings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const active = useMemo(
    () => (contests || []).filter((c) => c.status === 'active'),
    [contests]
  );
  const settled = useMemo(
    () => (contests || []).filter((c) => c.status === 'settled'),
    [contests]
  );

  const selectedId = contestId || active[0]?.id || settled[0]?.id || null;
  const selected = (contests || []).find((c) => c.id === selectedId) || null;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!apiDataEnabled) throw new Error('API выключен');
        const list = await api.get('/api/contests');
        if (!alive) return;
        setContests(list || []);
      } catch (err) {
        if (alive) setError(err.message || 'Ошибка загрузки');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId || !apiDataEnabled) {
      setStandings([]);
      return undefined;
    }
    let alive = true;
    let timer;
    const loadStandings = async () => {
      try {
        const data = await api.get(`/api/contests/${selectedId}/standings?limit=30`);
        if (!alive) return;
        setStandings(data?.standings || []);
      } catch {
        if (alive) setStandings([]);
      }
    };
    loadStandings();
    // Live board while contest is active
    if (selected?.status === 'active') {
      timer = setInterval(loadStandings, 45000);
    }
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [selectedId, selected?.status]);

  const boardRows =
    selected?.status === 'settled' && (selected.awards || []).length
      ? selected.awards.map((a) => ({
          place: a.place,
          user_id: a.user_id,
          display_name: a.display_name,
          avatar_path: a.avatar_path,
          score: a.score,
          report_place: null,
          reviews: null,
          comments: null,
        }))
      : standings;

  const lastSettled = settled[0] || null;

  return (
    <div className="ranking-page">
      <header className="ranking-page__head">
        <p className="ranking-page__eyebrow">Сообщество</p>
        <h1>Конкурсы и рейтинг</h1>
        <p className="ranking-page__lead">
          Участвуют отчёты об отдыхе в Перми и Пермском крае — не только про улов, а про поездки,
          базы, природу и впечатления. Места обновляются по голосам и активности. Призы
          начисляются на баланс в личном кабинете.
        </p>
        <div className="ranking-page__controls">
          <Link to="/reports" className="ranking-page__link">
            Опубликовать отчёт →
          </Link>
          <Link to="/cabinet/balance" className="ranking-page__link">
            Мой баланс →
          </Link>
        </div>
      </header>

      {error && <p className="ranking-page__error">{error}</p>}

      {loading ? (
        <p className="ranking-page__muted">Загрузка…</p>
      ) : !contests.length ? (
        <p className="ranking-page__muted">Пока нет активных или завершённых конкурсов.</p>
      ) : (
        <>
          {(active.length > 0 || settled.length > 0) && (
            <div className="ranking-page__tabs" role="tablist" aria-label="Конкурсы">
              {active.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={selectedId === c.id ? 'is-active' : ''}
                  onClick={() => navigate(`/ranking/${c.id}`)}
                >
                  {c.status === 'active' ? 'Сейчас: ' : ''}
                  {c.title}
                </button>
              ))}
              {settled.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={selectedId === c.id ? 'is-active' : ''}
                  onClick={() => navigate(`/ranking/${c.id}`)}
                >
                  Прошедший: {c.title}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <section className="ranking-page__prize">
              <div className="ranking-page__prize-head">
                <div>
                  <p className="ranking-page__eyebrow">{typeLabel(selected.type)}</p>
                  <h2>{selected.title}</h2>
                  <p>
                    {selected.description ||
                      (selected.type === 'reports'
                        ? 'Участвуют все одобренные отчёты на сайте — и старые, и новые. Места зависят от голосов.'
                        : 'Пишите отзывы и комментарии — места зависят от активности.')}
                  </p>
                  <p className="ranking-page__dates">
                    {formatWhen(selected.starts_at)} — {formatWhen(selected.ends_at)}
                    {selected.status === 'active' ? ' · идёт сейчас' : ' · завершён'}
                  </p>
                </div>
                <ul className="ranking-page__prizes">
                  {(selected.prizes || []).map((p) => (
                    <li key={p.place}>
                      <span>{p.place} место</span>
                      <strong>{formatMoney(p.amount_rub)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {selected?.status === 'active' && (
            <h3 className="ranking-page__board-title">Таблица мест (обновляется по голосам)</h3>
          )}
          {selected?.status === 'settled' && (
            <h3 className="ranking-page__board-title">Победители конкурса</h3>
          )}

          <StandingsList
            rows={boardRows}
            contestType={selected?.type}
            emptyText={
              selected?.status === 'active'
                ? 'Пока нет голосов — откройте отчёты на сайте и поддержите понравившиеся.'
                : 'Победители ещё не зафиксированы.'
            }
          />

          {lastSettled && lastSettled.id !== selectedId && (lastSettled.awards || []).length > 0 && (
            <section className="ranking-page__winners">
              <h3>В прошлом конкурсе победили</h3>
              <p className="ranking-page__muted">{lastSettled.title}</p>
              <ul className="ranking-page__winners-list">
                {lastSettled.awards.map((a) => (
                  <li key={a.id}>
                    <span className="ranking-page__place">{a.place}</span>
                    <Avatar name={a.display_name} src={a.avatar_path} />
                    <div className="ranking-page__who">
                      {a.user_id ? (
                        <Link to={`/u/${a.user_id}`}>{a.display_name || 'Участник'}</Link>
                      ) : (
                        <strong>{a.display_name || 'Участник'}</strong>
                      )}
                      <span>{formatMoney(a.amount_rub)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="ranking-page__link-btn"
                onClick={() => navigate(`/ranking/${lastSettled.id}`)}
              >
                Смотреть прошлый конкурс →
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
