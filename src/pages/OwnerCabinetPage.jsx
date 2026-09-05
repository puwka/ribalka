import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import CabinetShell from '../components/cabinet/CabinetShell';
import { RequireRole } from '../components/auth/RequireAuth';
import { useAuth } from '../components/auth/AuthContext';
import { basesService } from '../services/basesService';
import {
  ownerDashboardService,
  PERIODS,
} from '../services/ownerDashboardService';
import BaseListingForm, { statusLabel } from '../components/bases/BaseListingForm';
import { LineChart, PeriodFilters } from '../components/owner/OwnerCharts';
import OwnerBookingsPanel from './OwnerBookingsPanel';
import {
  OwnerSubscriptionPanel,
  OwnerPaymentsPanel,
  OwnerAdvertisingPanel,
  OwnerPaymentReturnPage,
} from '../components/owner/OwnerMonetization';
import {
  OwnerListingCheckoutPage,
  OwnerListingPaymentResultPage,
  OwnerListingOrdersPanel,
} from '../components/owner/ListingPayment';
import { apiDataEnabled } from '../lib/apiClient';
import '../components/auth/AuthShared.css';
import '../components/bases/BaseListingForm.css';
import '../components/owner/OwnerCharts.css';

const OWNER_NAV = [
  {
    title: 'Обзор',
    items: [
      { to: '/owner', end: true, label: 'Сводка' },
      { to: '/owner/analytics', label: 'Аналитика' },
    ],
  },
  {
    title: 'Объекты',
    items: [
      { to: '/owner/bases', label: 'Мои базы' },
      { to: '/owner/bases/new', label: 'Добавить базу' },
      { to: '/owner/bookings', label: 'Бронирования' },
      { to: '/owner/reviews', label: 'Отзывы' },
    ],
  },
  {
    title: 'Монетизация',
    items: [
      { to: '/owner/subscription', label: 'Подписка' },
      { to: '/owner/payments', label: 'Платежи' },
      { to: '/owner/advertising', label: 'Реклама' },
    ],
  },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

function OwnerDashboard() {
  const { user, profile } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await ownerDashboardService.getDashboard(user.id, period);
        if (alive) setData(next);
      } catch (err) {
        if (alive) setError(err.message || 'Ошибка загрузки');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, period]);

  if (loading) return <div className="cabinet-panel">Загрузка сводки…</div>;
  if (error) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="cabinet-panel">
      <h2>{profile?.display_name || 'Владелец'}</h2>
      <p className="cabinet-panel__lead">
        Показатели по просмотрам, переходам, избранному и отзывам за выбранный период.
      </p>

      <PeriodFilters value={period} onChange={setPeriod} periods={PERIODS} />

      <div className="cabinet-metrics">
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Базы</div>
          <div className="cabinet-metric__value">{data.basesCount}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Просмотры</div>
          <div className="cabinet-metric__value">{data.views}</div>
          <div className="cabinet-metric__hint">уник. {data.uniqueViews}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Переходы</div>
          <div className="cabinet-metric__value">{data.clicks}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Рейтинг</div>
          <div className="cabinet-metric__value">{data.rating || '—'}</div>
          <div className="cabinet-metric__hint">отзывов {data.reviewsCount}</div>
        </div>
      </div>

      <div className="owner-dash__top">
        <div>
          <div className="cabinet-section__head" style={{ marginBottom: 12 }}>
            <h3>Активность</h3>
            <Link to="/owner/analytics" className="btn btn--ghost">
              Подробнее
            </Link>
          </div>
          <div className="owner-charts-grid">
            <LineChart title="Просмотры" points={data.charts.views} color="#1d4ed8" />
            <LineChart title="Переходы" points={data.charts.clicks} color="#0f766e" />
          </div>
        </div>

        <div className="owner-dash__plan">
          <h3>Тариф</h3>
          <p>
            {data.plan?.name || data.subscription?.plan_code || 'Не выбран'}
            <br />
            Статус: {data.subscription?.status || '—'}
            <br />
            До: {formatDate(data.subscription?.current_period_end)}
          </p>
          <div className="cabinet-actions" style={{ marginTop: 0 }}>
            <Link className="btn-secondary" to="/owner/subscription">
              Управление
            </Link>
            <Link className="btn-primary" to="/owner/bases/new">
              Добавить базу
            </Link>
          </div>
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            В избранное: <strong>{data.favorites}</strong>
          </p>
        </div>
      </div>

      <section className="cabinet-section">
        <div className="cabinet-section__head">
          <h3>Базы по метрикам</h3>
          <Link to="/owner/bases" className="btn btn--ghost">
            Все базы
          </Link>
        </div>
        {(data.byBase || []).length === 0 ? (
          <div className="empty-state">Баз пока нет</div>
        ) : (
          <div className="cabinet-list">
            {data.byBase.slice(0, 5).map((b) => (
              <div key={b.id} className="cabinet-row">
                <div>
                  <div className="cabinet-row__title">
                    {b.name}{' '}
                    <span className={`status-badge status-badge--${b.status}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <div className="cabinet-row__meta">
                    Просмотры {b.views} · переходы {b.clicks} · избранное {b.favorites} · рейтинг{' '}
                    {b.rating || '—'}
                  </div>
                </div>
                <div className="cabinet-row__actions">
                  <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                    Карточка
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OwnerAnalytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ownerDashboardService.getDashboard(user.id, period).then(setData).finally(() => setLoading(false));
  }, [user, period]);

  if (loading || !data) return <div className="cabinet-panel">Загрузка аналитики…</div>;

  return (
    <div className="cabinet-panel">
      <h2>Аналитика</h2>
      <p className="cabinet-panel__lead">Детализация по базам за выбранный период</p>
      <PeriodFilters value={period} onChange={setPeriod} periods={PERIODS} />

      <div className="owner-charts-grid">
        <LineChart title="Просмотры" points={data.charts.views} />
        <LineChart title="Переходы" points={data.charts.clicks} color="#7c3aed" />
      </div>

      <div className="cabinet-list" style={{ marginTop: 12 }}>
        {data.byBase.map((b) => (
          <div key={b.id} className="cabinet-row">
            <div>
              <div className="cabinet-row__title">
                {b.name}{' '}
                <span className={`status-badge status-badge--${b.status}`}>
                  {statusLabel(b.status)}
                </span>
              </div>
              <div className="cabinet-row__meta">
                Просмотры {b.views} · уник. {b.uniqueViews} · переходы {b.clicks} · избранное{' '}
                {b.favorites} · отзывы {b.reviews} · рейтинг {b.rating || '—'}
              </div>
            </div>
            <div className="cabinet-row__actions">
              <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                Карточка
              </Link>
            </div>
          </div>
        ))}
        {data.byBase.length === 0 && <div className="empty-state">Нет баз для аналитики</div>}
      </div>
    </div>
  );
}

function OwnerBases() {
  const { user } = useAuth();
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dash, setDash] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, metrics] = await Promise.all([
        basesService.listMine(user.id),
        ownerDashboardService.getDashboard(user.id, '30d').catch(() => null),
      ]);
      setBases(list);
      setDash(metrics);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить базы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const submit = async (id) => {
    setError('');
    try {
      if (apiDataEnabled) {
        window.location.assign(`/owner/payment/${id}`);
        return;
      }
      await basesService.submitForReview(user.id, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const metricsById = Object.fromEntries((dash?.byBase || []).map((b) => [String(b.id), b]));

  return (
    <div className="cabinet-panel">
      <h2>Мои базы</h2>
      <p className="cabinet-panel__lead">
        Карточки объектов: статус, метрики за 30 дней и действия.
      </p>
      <div className="cabinet-actions" style={{ marginTop: 0, marginBottom: 8 }}>
        <Link className="btn-primary" to="/owner/bases/new">
          Добавить базу
        </Link>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <div className="empty-state">Загрузка…</div>
      ) : bases.length === 0 ? (
        <div className="empty-state">Баз пока нет — создайте первую карточку</div>
      ) : (
        <div className="owner-base-list">
          {bases.map((b) => {
            const m = metricsById[String(b.id)];
            const cover = b.images?.[0];
            return (
              <article key={b.id} className="owner-base-card">
                <div className="owner-base-card__media">
                  {cover ? <img src={cover} alt="" loading="lazy" /> : null}
                </div>
                <div className="owner-base-card__body">
                  <div className="owner-base-card__title">
                    {b.name}{' '}
                    <span className={`status-badge status-badge--${b.status}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <div className="owner-base-card__meta">
                    {[b.region, b.address].filter(Boolean).join(' · ') || 'Адрес не указан'}
                    <br />
                    {b.price_label || b.price || 'Цена не указана'}
                    {m && (
                      <>
                        <br />
                        Просмотры {m.views} · избранное {m.favorites} · рейтинг {m.rating || '—'}
                      </>
                    )}
                    {b.status === 'rejected' && b.rejection_reason && (
                      <>
                        <br />
                        <strong style={{ color: 'var(--color-danger)' }}>
                          Отказ: {b.rejection_reason}
                        </strong>
                      </>
                    )}
                    {b.updated_at && (
                      <>
                        <br />
                        Обновлено {formatDate(b.updated_at)}
                      </>
                    )}
                  </div>
                </div>
                <div className="owner-base-card__actions">
                  {['draft', 'rejected'].includes(b.status) && (
                    <>
                      <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                        Редактировать
                      </Link>
                      <button type="button" className="btn-primary" onClick={() => submit(b.id)}>
                        {apiDataEnabled ? 'Разместить / оплатить' : 'На модерацию'}
                      </button>
                    </>
                  )}
                  {b.status === 'approved' && (
                    <>
                      <Link className="btn-secondary" to={`/waters/${b.id}`}>
                        Просмотреть
                      </Link>
                      <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                        Карточка
                      </Link>
                      <Link className="btn-secondary" to="/owner/analytics">
                        Статистика
                      </Link>
                    </>
                  )}
                  {(b.status === 'pending' || b.status === 'moderation') && (
                    <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                      Просмотр
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OwnerBaseCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="cabinet-panel">
      <h2>Добавить базу</h2>
      <p className="cabinet-panel__lead">Заполните карточку и отправьте на модерацию</p>
      <BaseListingForm
        submitLabel="Сохранить черновик"
        sendLabel={apiDataEnabled ? 'К оплате размещения' : 'Сохранить и на модерацию'}
        onSubmit={async (form) => {
          const saved = await basesService.saveDraft(user.id, form);
          navigate(`/owner/bases/${saved.id}/edit`);
        }}
        onSubmitAndSend={async (form) => {
          const saved = await basesService.saveDraft(user.id, form);
          if (apiDataEnabled) {
            navigate(`/owner/payment/${saved.id}`);
            return;
          }
          await basesService.submitForReview(user.id, saved.id);
          navigate('/owner/bases');
        }}
      />
    </div>
  );
}

function OwnerBaseEdit() {
  const { user } = useAuth();
  const { baseId } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const row = await basesService.getById(baseId, { ownerId: user.id });
      if (!row || row.owner_id !== user.id) throw new Error('База не найдена или нет доступа');
      setRecord(row);
      setInitial(basesService.recordToForm(row));
    } catch (err) {
      setError(err.message);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, baseId]);

  if (loading) return <div className="cabinet-panel">Загрузка…</div>;
  if (error && !record) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error}</div>
        <Link className="btn-secondary" to="/owner/bases">Назад</Link>
      </div>
    );
  }

  const editable = ['draft', 'rejected'].includes(record.status);

  return (
    <div className="cabinet-panel">
      <h2>База: {record.name}</h2>
      <p className="cabinet-panel__lead">
        Статус:{' '}
        <span className={`status-badge status-badge--${record.status}`}>
          {statusLabel(record.status)}
        </span>
        {' · '}описание, цены, услуги, контакты, фото, видео
      </p>
      {record.status === 'rejected' && record.rejection_reason && (
        <div className="auth-error" style={{ marginBottom: 12 }}>
          Причина отказа: {record.rejection_reason}
        </div>
      )}
      {message && <div className="auth-success">{message}</div>}
      {!editable ? (
        <div>
          <div className="empty-state" style={{ marginBottom: 12 }}>
            Редактирование недоступно в статусе «{statusLabel(record.status)}».
          </div>
          <div className="cabinet-item">
            <div className="cabinet-item__meta">
              <strong>Описание:</strong> {record.description}
              <br />
              <strong>Цены:</strong> {record.price_label || record.price || '—'}
              <br />
              <strong>Услуги:</strong> {(record.services || []).join(', ') || '—'}
              <br />
              <strong>Контакты:</strong> {record.phone} {record.contacts || ''}
              <br />
              <strong>Фото:</strong> {(record.images || []).length} · <strong>Видео:</strong>{' '}
              {(record.videos || []).length}
            </div>
          </div>
        </div>
      ) : (
        <BaseListingForm
          key={record.updated_at || record.id}
          initialForm={initial}
          submitLabel="Сохранить"
          sendLabel={apiDataEnabled ? 'К оплате размещения' : 'Сохранить и на модерацию'}
          onSubmit={async (form) => {
            const saved = await basesService.saveDraft(user.id, form, baseId);
            setRecord(saved);
            setInitial(basesService.recordToForm(saved));
            setMessage('Сохранено');
          }}
          onSubmitAndSend={async (form) => {
            const saved = await basesService.saveDraft(user.id, form, baseId);
            if (apiDataEnabled) {
              navigate(`/owner/payment/${saved.id}`);
              return;
            }
            await basesService.submitForReview(user.id, saved.id);
            setMessage('Отправлено на модерацию');
            await load();
          }}
        />
      )}
      <div className="cabinet-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn-secondary" onClick={() => navigate('/owner/bases')}>
          К списку
        </button>
      </div>
    </div>
  );
}

function OwnerReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setReviews(await ownerDashboardService.listReviews(user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const reply = async (reviewId) => {
    setError('');
    try {
      await ownerDashboardService.replyToReview(user.id, reviewId, drafts[reviewId] || '');
      setDrafts((d) => ({ ...d, [reviewId]: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="cabinet-panel">
      <h2>Отзывы</h2>
      <p className="cabinet-panel__lead">Просмотр и ответ владельца</p>
      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <div className="empty-state">Загрузка…</div>
      ) : (
        <div className="cabinet-list">
          {reviews.length === 0 && <div className="empty-state">Отзывов пока нет</div>}
          {reviews.map((r) => (
            <div key={r.id} className="cabinet-item">
              <div className="cabinet-item__title">
                {r.base_name} · {r.author_name} · ⭐ {r.rating}
              </div>
              <div className="cabinet-item__meta">
                {r.body}
                <br />
                {formatDate(r.created_at)}
              </div>
              {r.owner_reply ? (
                <div className="auth-success" style={{ marginTop: 10 }}>
                  Ваш ответ: {r.owner_reply}
                </div>
              ) : (
                <div className="cabinet-form" style={{ marginTop: 10 }}>
                  <textarea
                    rows={2}
                    placeholder="Ответ владельца"
                    value={drafts[r.id] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <button type="button" className="btn-primary" onClick={() => reply(r.id)}>
                    Ответить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerPayments() {
  if (apiDataEnabled) return <OwnerListingOrdersPanel />;
  return <OwnerPaymentsPanel />;
}

function OwnerSubscription() {
  return <OwnerSubscriptionPanel />;
}

function OwnerAdvertising() {
  return <OwnerAdvertisingPanel />;
}

function OwnerLayout() {
  return (
    <CabinetShell
      title="Кабинет владельца"
      subtitle="Базы, бронирования и монетизация"
      navGroups={OWNER_NAV}
    />
  );
}

export default function OwnerCabinetPage() {
  return (
    <RequireRole roles={['owner', 'admin']} fallback="/cabinet">
      <Routes>
        <Route element={<OwnerLayout />}>
          <Route index element={<OwnerDashboard />} />
          <Route path="bases" element={<OwnerBases />} />
          <Route path="bases/new" element={<OwnerBaseCreate />} />
          <Route path="bases/:baseId/edit" element={<OwnerBaseEdit />} />
          <Route path="bookings" element={<OwnerBookingsPanel />} />
          <Route path="analytics" element={<OwnerAnalytics />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="payments" element={<OwnerPayments />} />
          <Route path="payments/return" element={<OwnerPaymentReturnPage />} />
          <Route path="payment/result/:orderId" element={<OwnerListingPaymentResultPage />} />
          <Route path="payment/:baseId" element={<OwnerListingCheckoutPage />} />
          <Route path="subscription" element={<OwnerSubscription />} />
          <Route path="advertising" element={<OwnerAdvertising />} />
          {/* legacy redirects */}
          <Route path="stats" element={<Navigate to="/owner/analytics" replace />} />
          <Route path="plan" element={<Navigate to="/owner/subscription" replace />} />
          <Route path="ads" element={<Navigate to="/owner/advertising" replace />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Route>
      </Routes>
    </RequireRole>
  );
}
