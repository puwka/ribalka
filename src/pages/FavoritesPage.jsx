import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequireAuth } from '../components/auth/RequireAuth';
import { useAuth } from '../components/auth/AuthContext';
import { favoritesService } from '../services/favoritesService';
import './FavoritesPage.css';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'base', label: 'Базы' },
  { id: 'place', label: 'Места' },
  { id: 'report', label: 'Отчёты' },
];

function typeLabel(type) {
  if (type === 'base') return 'Платный водоём';
  if (type === 'place') return 'Бесплатный водоём';
  if (type === 'report') return 'Отчёт';
  return type;
}

function linkFor(item) {
  if (item.type === 'report') return `/reports/${item.target_id}`;
  if (item.type === 'place') return `/waters/${item.target_id}`;
  if (item.type === 'base') return `/waters/${item.target_id}`;
  return '/paid-waters';
}

function FavoritesContent({ embedded = false }) {
  const { user, refresh } = useAuth();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [compareRows, setCompareRows] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await favoritesService.list(user.id, filter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, filter]);

  const comparable = useMemo(
    () => items.filter((i) => i.type === 'base' || i.type === 'place'),
    [items]
  );

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const sid = String(id);
      if (prev.includes(sid)) return prev.filter((x) => x !== sid);
      if (prev.length >= 3) return prev;
      return [...prev, sid];
    });
  };

  const runCompare = async () => {
    setError('');
    try {
      const rows = await favoritesService.resolveForCompare(user.id, selected);
      setCompareRows(rows);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (item) => {
    await favoritesService.remove(user.id, item.type, item.target_id);
    setSelected((prev) => prev.filter((id) => id !== String(item.target_id)));
    await load();
    await refresh();
  };

  return (
    <div className={`favorites-page${embedded ? ' favorites-page--embedded' : ''}`}>
      <div className="favorites-page__container">
        {!embedded && (
          <header className="favorites-page__header">
            <div>
              <h1>Избранное</h1>
              <p>Базы, места и отчёты — с быстрым переходом и сравнением</p>
            </div>
            <Link to="/cabinet" className="favorites-page__ghost">
              В кабинет
            </Link>
          </header>
        )}
        {embedded && (
          <header className="favorites-page__header favorites-page__header--embedded">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Избранное</h2>
              <p>Сохранённые водоёмы и отчёты</p>
            </div>
          </header>
        )}

        <div className="favorites-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`favorites-filters__btn${filter === f.id ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <div className="favorites-error">{error}</div>}

        {comparable.length >= 2 && (
          <div className="favorites-compare-bar">
            <span>Сравнение баз/мест: выбрано {selected.length}/3</span>
            <button
              type="button"
              className="favorites-btn"
              disabled={selected.length < 2}
              onClick={runCompare}
            >
              Сравнить
            </button>
            {selected.length > 0 && (
              <button type="button" className="favorites-btn favorites-btn--ghost" onClick={() => { setSelected([]); setCompareRows([]); }}>
                Сбросить
              </button>
            )}
          </div>
        )}

        {compareRows.length >= 2 && (
          <div className="favorites-compare-table-wrap">
            <table className="favorites-compare-table">
              <thead>
                <tr>
                  <th>Параметр</th>
                  {compareRows.map((r) => (
                    <th key={r.id}>{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Тип', (r) => (r.type === 'place' ? 'Место' : 'База')],
                  ['Цена', (r) => r.price],
                  ['Адрес', (r) => r.address],
                  ['Рыба', (r) => r.fish],
                  ['Услуги', (r) => (r.services || []).join(', ') || '—'],
                  ['Телефон', (r) => r.phone],
                  ['График', (r) => r.workHours],
                ].map(([label, getter]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {compareRows.map((r) => (
                      <td key={`${r.id}-${label}`}>{getter(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading ? (
          <div className="favorites-empty">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="favorites-empty">
            Пока пусто. Добавляйте объекты кнопкой «☆» в карточках баз и отчётов.
          </div>
        ) : (
          <div className="favorites-grid">
            {items.map((item) => {
              const snap = item.snapshot || {};
              const selectable = item.type === 'base' || item.type === 'place';
              const isSelected = selected.includes(String(item.target_id));
              return (
                <article key={item.id} className={`favorites-card${isSelected ? ' is-selected' : ''}`}>
                  {snap.image && (
                    <div className="favorites-card__media">
                      <img src={snap.image} alt={snap.name || ''} />
                    </div>
                  )}
                  <div className="favorites-card__body">
                    <div className="favorites-card__type">{typeLabel(item.type)}</div>
                    <h3>{snap.name || 'Без названия'}</h3>
                    <p>{snap.short || snap.address || ''}</p>
                    <div className="favorites-card__actions">
                      <Link className="favorites-btn" to={linkFor(item)}>
                        Перейти
                      </Link>
                      {selectable && (
                        <button
                          type="button"
                          className="favorites-btn favorites-btn--ghost"
                          onClick={() => toggleSelect(item.target_id)}
                        >
                          {isSelected ? 'Убрать из сравнения' : 'К сравнению'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="favorites-btn favorites-btn--danger"
                        onClick={() => remove(item)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FavoritesPage({ embedded = false }) {
  return (
    <RequireAuth>
      <FavoritesContent embedded={embedded} />
    </RequireAuth>
  );
}
