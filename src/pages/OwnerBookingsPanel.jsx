import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/auth/AuthContext';
import { bookingService } from '../services/bookingService';
import { basesService } from '../services/basesService';
import '../components/auth/AuthShared.css';
import './OwnerBookingsPanel.css';

const STATUS_LABEL = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  completed: 'Завершена',
};

function statusClass(s) {
  return `ob-status ob-status--${s}`;
}

export default function OwnerBookingsPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('list');
  const [bookings, setBookings] = useState([]);
  const [bases, setBases] = useState([]);
  const [filter, setFilter] = useState('all');
  const [baseId, setBaseId] = useState('');
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [list, mine] = await Promise.all([
        bookingService.listForOwner(user.id),
        basesService.listMine(user.id),
      ]);
      setBookings(list);
      setBases(mine);
      setBaseId((prev) => prev || (mine[0] ? String(mine[0].id) : ''));
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || !baseId || tab !== 'calendar') return;
      try {
        const data = await bookingService.getOwnerCalendar(
          user.id,
          baseId,
          cursor.getFullYear(),
          cursor.getMonth()
        );
        if (alive) setCalendar(data);
      } catch (err) {
        if (alive) setError(err.message || 'Календарь недоступен');
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, baseId, cursor, tab, bookings]);

  const filtered = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const act = async (fn) => {
    setBusyId('x');
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || 'Ошибка');
    } finally {
      setBusyId('');
    }
  };

  const toggleBlock = async (date, blocked) => {
    await act(() => bookingService.setDayBlocked(user.id, baseId, date, blocked));
  };

  if (loading) return <div className="cabinet-panel">Загрузка бронирований…</div>;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const pad = firstDow === 0 ? 6 : firstDow - 1;
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  return (
    <div className="cabinet-panel owner-bookings">
      <h2>Бронирования</h2>
      <p className="cabinet-panel__lead">
        Принимайте и отклоняйте заявки, управляйте доступностью и смотрите календарь загрузки.
      </p>

      {error && <div className="auth-error">{error}</div>}

      <div className="ob-tabs">
        <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          Заявки
        </button>
        <button
          type="button"
          className={tab === 'calendar' ? 'active' : ''}
          onClick={() => setTab('calendar')}
        >
          Календарь
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="ob-filters">
            {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map((s) => (
              <button
                key={s}
                type="button"
                className={filter === s ? 'active' : ''}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'Все' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="cabinet-list">
            {filtered.length === 0 && <div className="empty-state">Пока нет бронирований</div>}
            {filtered.map((b) => (
              <div key={b.id} className="cabinet-item">
                <div className="cabinet-item__title">
                  {b.base_name}{' '}
                  <span className={statusClass(b.status)}>{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <div className="cabinet-item__meta">
                  {b.check_in} → {b.check_out} · {b.nights} ноч. · {b.service} · гостей: {b.guests_count}
                  <br />
                  {b.contact_name} · {b.contact_phone}
                  {b.notes ? (
                    <>
                      <br />
                      Комментарий: {b.notes}
                    </>
                  ) : null}
                  {b.decision_note ? (
                    <>
                      <br />
                      Решение: {b.decision_note}
                    </>
                  ) : null}
                </div>
                <div className="cabinet-actions">
                  {b.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={Boolean(busyId)}
                        onClick={() => act(() => bookingService.confirm(user.id, b.id))}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={Boolean(busyId)}
                        onClick={() => {
                          const note = window.prompt('Причина отклонения (необязательно)') || '';
                          act(() => bookingService.reject(user.id, b.id, note));
                        }}
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={Boolean(busyId)}
                        onClick={() => act(() => bookingService.complete(user.id, b.id))}
                      >
                        Завершить
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={Boolean(busyId)}
                        onClick={() => act(() => bookingService.reject(user.id, b.id, 'Отменено владельцем'))}
                      >
                        Отменить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'calendar' && (
        <div className="ob-calendar">
          <div className="ob-cal-toolbar">
            <label>
              База
              <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                {bases.length === 0 && <option value="">Нет баз</option>}
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="ob-cal-nav">
              <button
                type="button"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                aria-label="Предыдущий"
              >
                ‹
              </button>
              <strong>
                {monthNames[month]} {year}
              </strong>
              <button
                type="button"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                aria-label="Следующий"
              >
                ›
              </button>
            </div>
          </div>

          <div className="ob-weekdays">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="ob-grid">
            {Array.from({ length: pad }).map((_, i) => (
              <div key={`pad-${i}`} className="ob-day is-empty" />
            ))}
            {(calendar?.days || []).map((day) => (
              <button
                key={day.date}
                type="button"
                className={[
                  'ob-day',
                  day.blocked ? 'is-blocked' : '',
                  day.booked_count ? 'is-booked' : '',
                  day.pending_count ? 'is-pending' : '',
                  selectedDay?.date === day.date ? 'is-selected' : '',
                ].join(' ')}
                onClick={() => setSelectedDay(day)}
              >
                <span>{Number(day.date.slice(-2))}</span>
                {(day.booked_count > 0 || day.pending_count > 0) && (
                  <em>
                    {day.booked_count}✓ {day.pending_count}?
                  </em>
                )}
              </button>
            ))}
          </div>

          <div className="ob-legend">
            <span><i className="dot booked" /> Подтверждено</span>
            <span><i className="dot pending" /> Ожидает</span>
            <span><i className="dot blocked" /> Закрыто</span>
          </div>

          {selectedDay && (
            <div className="ob-day-panel">
              <h3>{selectedDay.date}</h3>
              <p>
                {selectedDay.blocked
                  ? 'День закрыт для бронирования'
                  : 'День открыт для бронирования'}
                {selectedDay.booked_count
                  ? ` · подтверждённых: ${selectedDay.booked_count}`
                  : ''}
                {selectedDay.pending_count
                  ? ` · заявок: ${selectedDay.pending_count}`
                  : ''}
              </p>
              <div className="cabinet-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => toggleBlock(selectedDay.date, !selectedDay.blocked)}
                >
                  {selectedDay.blocked ? 'Открыть день' : 'Закрыть день'}
                </button>
              </div>
              {selectedDay.bookings?.length > 0 && (
                <ul className="ob-day-bookings">
                  {selectedDay.bookings.map((b) => (
                    <li key={b.id}>
                      {STATUS_LABEL[b.status]} · {b.contact_name} · {b.service}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
