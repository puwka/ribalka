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
import BaseConstructorPricing, {
  DEFAULT_BASE_OPTIONS,
  buildPaymentQuery,
} from '../components/bases/BaseConstructorPricing';
import { LineChart, PeriodFilters } from '../components/owner/OwnerCharts';
import {
  OwnerSubscriptionPanel,
  OwnerPaymentsPanel,
  OwnerPaymentReturnPage,
} from '../components/owner/OwnerMonetization';
import {
  OwnerListingCheckoutPage,
  OwnerListingPaymentResultPage,
  OwnerListingOrdersPanel,
} from '../components/owner/ListingPayment';
import { apiDataEnabled } from '../lib/apiClient';
import { directoryOwnerService } from '../services/directoryOwnerService';
import DirectoryListingForm, {
  directoryStatusLabel,
} from '../components/directory/DirectoryListingForm';
import OwnerDirectoryCheckout from '../components/directory/OwnerDirectoryCheckout';
import DirectoryConstructorPricing, {
  DEFAULT_DIRECTORY_OPTIONS,
  buildDirectoryPaymentQuery,
} from '../components/directory/DirectoryConstructorPricing';
import { listingPaymentService } from '../services/listingPaymentService';
import {
  formatRub,
  normalizeConstructor,
  normalizeServiceTariff,
  calcConstructorTotal,
  calcServiceTotal,
} from '../lib/directoryPricing';
import '../components/auth/AuthShared.css';
import '../components/bases/BaseListingForm.css';
import '../components/owner/OwnerCharts.css';
import '../components/directory/DirectoryListingForm.css';
import '../components/directory/DirectoryPricingForm.css';

const OWNER_NAV = [
  {
    title: 'Обзор',
    items: [
      { to: '/owner', end: true, label: 'Сводка' },
      { to: '/owner/analytics', label: 'Аналитика баз' },
      { to: '/owner/directory-analytics', label: 'Аналитика справочника' },
    ],
  },
  {
    title: 'Объекты',
    items: [
      { to: '/owner/bases', label: 'Мои базы' },
      { to: '/owner/bases/new', label: 'Добавить базу' },
      { to: '/owner/directory', label: 'Магазины / сервисы / егеря' },
      { to: '/owner/directory/new', label: 'Добавить в справочник' },
      { to: '/owner/reviews', label: 'Отзывы' },
    ],
  },
  {
    title: 'Монетизация',
    items: [
      { to: '/owner/subscription', label: 'Тарифы' },
      { to: '/owner/payments', label: 'Платежи' },
    ],
  },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

function isBaseExpired(b) {
  if (!b?.paid_until && !b?.paidUntil) return false;
  const until = b.paid_until || b.paidUntil;
  return new Date(until).getTime() <= Date.now();
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

function OwnerDirectoryAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await directoryOwnerService.getAnalytics(days);
        if (alive) setData(rows);
      } catch (err) {
        if (alive) setError(err.message || 'Не удалось загрузить аналитику');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  if (loading) return <div className="cabinet-panel">Загрузка аналитики справочника…</div>;

  const categoryLabel = { shop: 'Магазин', service: 'Сервис', guide: 'Гид / егерь' };

  return (
    <div className="cabinet-panel">
      <h2>Аналитика справочника</h2>
      <p className="cabinet-panel__lead">
        Просмотры карточки, звонки и переходы на сайт / в группу за выбранный период
      </p>
      {error && <div className="auth-error">{error}</div>}

      <div className="period-filters" style={{ marginBottom: 16 }}>
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            type="button"
            className={`period-filters__btn${days === d ? ' is-active' : ''}`}
            onClick={() => setDays(d)}
          >
            {d === 365 ? 'Год' : `${d} дн.`}
          </button>
        ))}
      </div>

      <div
        className="owner-stat-cards"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="owner-chart">
          <div className="owner-chart__title">Просмотры</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{data?.totals?.views ?? 0}</div>
        </div>
        <div className="owner-chart">
          <div className="owner-chart__title">Звонки</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{data?.totals?.phone ?? 0}</div>
        </div>
        <div className="owner-chart">
          <div className="owner-chart__title">Переходы на сайт</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{data?.totals?.website ?? 0}</div>
        </div>
      </div>

      <div className="cabinet-list">
        {(data?.items || []).map((item) => (
          <div key={item.id} className="cabinet-row">
            <div>
              <div className="cabinet-row__title">
                {item.name}{' '}
                <span className="cabinet-row__meta">
                  {categoryLabel[item.category] || item.category}
                  {!item.active ? ' · срок размещения истёк' : ''}
                </span>
              </div>
              <div className="cabinet-row__meta">
                Просмотры {item.views} · звонки {item.phone} · сайт {item.website}
                {item.paidUntil
                  ? ` · оплачено до ${new Date(item.paidUntil).toLocaleDateString('ru-RU')}`
                  : ''}
              </div>
            </div>
            <div className="cabinet-actions" style={{ margin: 0 }}>
              <Link className="btn-secondary" to={`/owner/directory/${item.id}/edit`}>
                Карточка
              </Link>
              {apiDataEnabled && (
                <Link className="btn-primary" to={`/owner/directory/${item.id}/pay`}>
                  {!item.active ? 'Продлить' : 'Продлить / доплатить'}
                </Link>
              )}
            </div>
          </div>
        ))}
        {(data?.items || []).length === 0 && (
          <div className="empty-state">
            Пока нет карточек. Добавьте магазин, сервис или егеря в разделе «Магазины / сервисы /
            егеря».
            <div style={{ marginTop: 12 }}>
              <Link className="btn-primary" to="/owner/directory/new">
                Добавить карточку
              </Link>
            </div>
          </div>
        )}
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
            const paidUntil = b.paid_until || b.paidUntil;
            const expired = isBaseExpired(b);
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
                    {expired && (
                      <span className="status-badge status-badge--rejected">Срок истёк</span>
                    )}
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
                    {paidUntil && (
                      <>
                        <br />
                        {expired
                          ? `Размещение истекло ${formatDate(paidUntil)} — база скрыта с сайта, продлите в кабинете`
                          : `Оплачено до ${formatDate(paidUntil)}`}
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
                  {(b.status === 'approved' || b.status === 'pending' || b.status === 'moderation') && (
                    <>
                      {b.status === 'approved' && !expired && (
                        <Link className="btn-secondary" to={`/waters/${b.id}`}>
                          Просмотреть
                        </Link>
                      )}
                      <Link className="btn-secondary" to={`/owner/bases/${b.id}/edit`}>
                        Карточка
                      </Link>
                      {apiDataEnabled && (expired || b.status === 'approved') && (
                        <Link className="btn-primary" to={`/owner/payment/${b.id}`}>
                          {expired ? 'Продлить' : 'Продлить / доплатить'}
                        </Link>
                      )}
                      <Link className="btn-secondary" to="/owner/analytics">
                        Статистика
                      </Link>
                    </>
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
  const [tariff, setTariff] = useState(() => normalizeConstructor({}));
  const [options, setOptions] = useState(DEFAULT_BASE_OPTIONS);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getPublicListingPrice()
      .then((p) => setTariff(normalizeConstructor(p)))
      .catch(() => {});
  }, []);

  const quote = calcConstructorTotal(tariff, options);
  const payLabel = apiDataEnabled
    ? `Сохранить и оплатить ${formatRub(quote.total)}`
    : 'Сохранить и на модерацию';

  return (
    <div className="cabinet-panel">
      <h2>Добавить базу</h2>
      <p className="cabinet-panel__lead">
        Заполните карточку, выберите опции размещения — стоимость видна сразу, как в справочнике.
      </p>

      {apiDataEnabled && (
        <BaseConstructorPricing tariff={tariff} options={options} onChange={setOptions} />
      )}

      <BaseListingForm
        submitLabel="Сохранить черновик"
        sendLabel={payLabel}
        mediaQuota={{
          includedPhotos: tariff.includedPhotos || 1,
          includedVideos: tariff.includedVideos || 1,
          extraPhotos: options.extraPhotos,
          extraVideos: options.extraVideos,
          addonPhoto: tariff.addonPhoto || 100,
          addonVideo: tariff.addonVideo || 100,
          payHref: null,
        }}
        onSubmit={async (form) => {
          const saved = await basesService.saveDraft(user.id, form);
          navigate(`/owner/bases/${saved.id}/edit`);
        }}
        onSubmitAndSend={async (form) => {
          const saved = await basesService.saveDraft(user.id, form);
          if (apiDataEnabled) {
            navigate(`/owner/payment/${saved.id}${buildPaymentQuery(options)}`);
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
  const [tariff, setTariff] = useState(() => normalizeConstructor({}));
  const [options, setOptions] = useState(DEFAULT_BASE_OPTIONS);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const row = await basesService.getById(baseId, { ownerId: user.id });
      if (!row || row.owner_id !== user.id) throw new Error('База не найдена или нет доступа');
      setRecord(row);
      setInitial(basesService.recordToForm(row));
      setOptions((prev) => ({
        ...prev,
        top: Boolean(row.is_top),
        frame: Boolean(row.yellow_frame),
        extraPhotos: Math.max(prev.extraPhotos, Number(row.paid_extra_photos) || 0),
        extraVideos: Math.max(prev.extraVideos, Number(row.paid_extra_videos) || 0),
      }));
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

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getPublicListingPrice()
      .then((p) => setTariff(normalizeConstructor(p)))
      .catch(() => {});
  }, []);

  if (loading) return <div className="cabinet-panel">Загрузка…</div>;
  if (error && !record) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error}</div>
        <Link className="btn-secondary" to="/owner/bases">
          Назад
        </Link>
      </div>
    );
  }

  const quote = calcConstructorTotal(tariff, options);
  const paidUntil = record.paid_until || record.paidUntil;
  const expired = isBaseExpired(record);
  const payLabel = apiDataEnabled
    ? expired || paidUntil
      ? `Продлить за ${formatRub(quote.total)}`
      : `Оплатить ${formatRub(quote.total)}`
    : 'Сохранить и на модерацию';

  return (
    <div className="cabinet-panel">
      <h2>База: {record.name}</h2>
      <p className="cabinet-panel__lead">
        Статус:{' '}
        <span className={`status-badge status-badge--${record.status}`}>
          {statusLabel(record.status)}
        </span>
        {paidUntil ? ` · оплачено до ${formatDate(paidUntil)}` : ''}
        {expired ? ' · срок истёк' : ''}
        {' · '}можно править карточку и сразу видеть стоимость продления
      </p>
      {record.status === 'rejected' && record.rejection_reason && (
        <div className="auth-error" style={{ marginBottom: 12 }}>
          Причина отказа: {record.rejection_reason}
        </div>
      )}
      {message && <div className="auth-success">{message}</div>}

      {apiDataEnabled && (
        <BaseConstructorPricing
          tariff={tariff}
          options={options}
          onChange={setOptions}
          title={expired || paidUntil ? 'Продление и опции' : 'Тариф и опции размещения'}
        />
      )}

      <BaseListingForm
        key={record.updated_at || record.id}
        initialForm={initial}
        submitLabel="Сохранить"
        sendLabel={payLabel}
        mediaQuota={{
          includedPhotos: tariff.includedPhotos || 1,
          includedVideos: tariff.includedVideos || 1,
          extraPhotos: Math.max(options.extraPhotos, Number(record.paid_extra_photos) || 0),
          extraVideos: Math.max(options.extraVideos, Number(record.paid_extra_videos) || 0),
          addonPhoto: tariff.addonPhoto || 100,
          addonVideo: tariff.addonVideo || 100,
          payHrefPhotos: `/owner/payment/${record.id}${buildPaymentQuery({
            ...options,
            extraPhotos: Math.max(options.extraPhotos, (Number(record.paid_extra_photos) || 0) + 1),
          })}`,
          payHrefVideos: `/owner/payment/${record.id}${buildPaymentQuery({
            ...options,
            extraVideos: Math.max(options.extraVideos, (Number(record.paid_extra_videos) || 0) + 1),
          })}`,
        }}
        onSubmit={async (form) => {
          const saved = await basesService.saveDraft(user.id, form, baseId);
          setRecord(saved);
          setInitial(basesService.recordToForm(saved));
          setMessage('Сохранено');
        }}
        onSubmitAndSend={async (form) => {
          const saved = await basesService.saveDraft(user.id, form, baseId);
          if (apiDataEnabled) {
            navigate(`/owner/payment/${saved.id}${buildPaymentQuery(options)}`);
            return;
          }
          await basesService.submitForReview(user.id, saved.id);
          setMessage('Отправлено на модерацию');
          await load();
        }}
      />
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

function OwnerDirectoryList() {
  const { refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const categoryLabel = { shop: 'Магазин', service: 'Сервис', guide: 'Гид / егерь' };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await refresh?.();
      const list = await directoryOwnerService.listMine();
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="cabinet-panel">
      <h2>Магазины, сервисы и егеря</h2>
      <p className="cabinet-panel__lead">
        Карточки справочника: редактирование, статистика и продление тарифа после истечения срока.
        С сайта скрываются только неоплаченные / истёкшие — в кабинете остаются всегда.
      </p>
      <div className="cabinet-actions" style={{ marginTop: 0, marginBottom: 8 }}>
        <Link className="btn-primary" to="/owner/directory/new">
          Добавить карточку
        </Link>
        <Link className="btn-secondary" to="/owner/directory-analytics">
          Статистика
        </Link>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <div className="empty-state">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">Пока нет карточек — создайте первую</div>
      ) : (
        <div className="cabinet-list">
          {items.map((item) => (
            <div key={item.id} className="cabinet-row">
              <div>
                <div className="cabinet-row__title">
                  {item.name}{' '}
                  <span className="cabinet-row__meta">
                    {categoryLabel[item.category] || item.category} ·{' '}
                    {directoryStatusLabel(item.status)}
                    {item.expired ? ' · срок истёк' : ''}
                  </span>
                </div>
                <div className="cabinet-row__meta">
                  {item.phone || 'Телефон не указан'}
                  {item.paidUntil ? ` · оплачено до ${formatDate(item.paidUntil)}` : ' · не оплачено'}
                </div>
              </div>
              <div className="cabinet-actions" style={{ margin: 0 }}>
                <Link className="btn-secondary" to={`/owner/directory/${item.id}/edit`}>
                  Редактировать
                </Link>
                {apiDataEnabled && (
                  <Link className="btn-primary" to={`/owner/directory/${item.id}/pay`}>
                    {item.expired || item.status === 'published' || item.paidUntil
                      ? 'Продлить / оплатить'
                      : 'Оплатить размещение'}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerDirectoryCreate() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [tariff, setTariff] = useState(() => normalizeServiceTariff({}));
  const [options, setOptions] = useState(DEFAULT_DIRECTORY_OPTIONS);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getDirectoryPrices()
      .then((data) => {
        setTariff(normalizeServiceTariff(data.service || data.directory || data.shop));
      })
      .catch(() => {});
  }, []);

  const quote = calcServiceTotal(tariff, options);
  const submitLabel = apiDataEnabled
    ? `Сохранить и оплатить ${formatRub(quote.total)}`
    : 'Сохранить';

  return (
    <div className="cabinet-panel">
      <h2>Добавить в справочник</h2>
      <p className="cabinet-panel__lead">
        Заполните карточку магазина, сервиса или егеря. Тариф и итоговая сумма — сразу, как у баз.
      </p>

      {apiDataEnabled && (
        <DirectoryConstructorPricing
          tariff={tariff}
          options={options}
          onChange={setOptions}
          title="Размещение в справочнике"
        />
      )}

      <DirectoryListingForm
        submitLabel={submitLabel}
        onSubmit={async (form) => {
          await refresh?.();
          const saved = await directoryOwnerService.createDraft(form);
          if (apiDataEnabled) {
            navigate(`/owner/directory/${saved.id}/pay${buildDirectoryPaymentQuery(options)}`);
            return;
          }
          navigate('/owner/directory');
        }}
      />
      <div style={{ marginTop: 12 }}>
        <Link className="btn-secondary" to="/owner/directory">
          Назад
        </Link>
      </div>
    </div>
  );
}

function OwnerDirectoryEdit() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tariff, setTariff] = useState(() => normalizeServiceTariff({}));
  const [options, setOptions] = useState(DEFAULT_DIRECTORY_OPTIONS);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const row = await directoryOwnerService.getById(itemId);
        if (!alive) return;
        setItem(row);
        setOptions((prev) => ({
          ...prev,
          top: Boolean(row?.isTop),
          frame: Boolean(row?.yellowFrame),
        }));
      } catch (err) {
        if (alive) setError(err.message || 'Не найдено');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemId]);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getDirectoryPrices()
      .then((data) => {
        setTariff(normalizeServiceTariff(data.service || data.directory || data.shop));
      })
      .catch(() => {});
  }, []);

  if (loading) return <div className="cabinet-panel">Загрузка…</div>;
  if (!item) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error || 'Не найдено'}</div>
        <Link to="/owner/directory">Назад</Link>
      </div>
    );
  }

  const quote = calcServiceTotal(tariff, options);
  const categoryTitle = {
    shop: 'Размещение магазина',
    service: 'Размещение сервиса',
    guide: 'Размещение гида / егеря',
  }[item.category] || 'Размещение в справочнике';

  return (
    <div className="cabinet-panel">
      <h2>Редактирование: {item.name}</h2>
      <p className="cabinet-panel__lead">
        {directoryStatusLabel(item.status)}
        {item.paidUntil ? ` · оплачено до ${formatDate(item.paidUntil)}` : ''}
        {item.expired ? ' · срок истёк, продлите оплату' : ''}
      </p>
      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-success">{message}</div>}

      {apiDataEnabled && (
        <DirectoryConstructorPricing
          tariff={tariff}
          options={options}
          onChange={setOptions}
          title={item.expired || item.paidUntil ? 'Продление и опции' : categoryTitle}
        />
      )}

      <DirectoryListingForm
        initial={item}
        lockCategory
        submitLabel="Сохранить"
        onSubmit={async (form) => {
          setError('');
          setMessage('');
          const saved = await directoryOwnerService.update(item.id, form);
          setItem(saved);
          setMessage('Сохранено');
        }}
      />
      <div className="cabinet-actions" style={{ marginTop: 16 }}>
        {apiDataEnabled && (
          <Link
            className="btn-primary"
            to={`/owner/directory/${item.id}/pay${buildDirectoryPaymentQuery(options)}`}
          >
            {item.expired
              ? `Продлить за ${formatRub(quote.total)}`
              : `Оплатить ${formatRub(quote.total)}`}
          </Link>
        )}
        <button type="button" className="btn-secondary" onClick={() => navigate('/owner/directory')}>
          К списку
        </button>
      </div>
    </div>
  );
}

function OwnerDirectoryPaymentResult() {
  const { orderId } = useParams();
  const { refresh } = useAuth();
  const [state, setState] = useState({ phase: 'checking', error: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await listingPaymentService.verifyDirectoryOrder(orderId);
        await refresh?.();
        if (!alive) return;
        setState({
          phase: result.paid || result.order?.status === 'paid' ? 'paid' : 'pending',
          error: '',
        });
      } catch (err) {
        if (alive) setState({ phase: 'error', error: err.message || 'Ошибка' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, refresh]);

  return (
    <div className="cabinet-panel">
      <h2>Оплата справочника</h2>
      {state.phase === 'checking' && <p>Проверяем оплату…</p>}
      {state.phase === 'paid' && (
        <>
          <p>Оплата получена. Карточка сохранена в кабинете; при новой заявке — на модерации.</p>
          <div className="cabinet-actions">
            <Link className="btn-primary" to="/owner/directory">
              Мои карточки
            </Link>
            <Link className="btn-secondary" to="/owner/directory-analytics">
              Статистика
            </Link>
          </div>
        </>
      )}
      {state.phase === 'pending' && (
        <>
          <p>Платёж ещё обрабатывается. Обновите страницу через минуту.</p>
          <p>
            Заказ: <code>{orderId}</code>
          </p>
          <Link className="btn-secondary" to="/owner/directory">
            К карточкам
          </Link>
        </>
      )}
      {state.phase === 'error' && (
        <>
          <div className="auth-error">{state.error}</div>
          <Link className="btn-secondary" to="/owner/directory">
            К карточкам
          </Link>
        </>
      )}
    </div>
  );
}

function OwnerSubscription() {
  return <OwnerSubscriptionPanel />;
}

function OwnerLayout() {
  return (
    <CabinetShell
      title="Кабинет владельца"
      subtitle="Базы, справочник, тарифы и статистика"
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
          <Route path="directory" element={<OwnerDirectoryList />} />
          <Route path="directory/new" element={<OwnerDirectoryCreate />} />
          <Route path="directory/payment/result/:orderId" element={<OwnerDirectoryPaymentResult />} />
          <Route path="directory/:itemId/edit" element={<OwnerDirectoryEdit />} />
          <Route path="directory/:itemId/pay" element={<OwnerDirectoryCheckout />} />
          <Route path="bookings" element={<Navigate to="/owner" replace />} />
          <Route path="analytics" element={<OwnerAnalytics />} />
          <Route path="directory-analytics" element={<OwnerDirectoryAnalytics />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="payments" element={<OwnerPayments />} />
          <Route path="payments/return" element={<OwnerPaymentReturnPage />} />
          <Route path="payment/result/:orderId" element={<OwnerListingPaymentResultPage />} />
          <Route path="payment/:baseId" element={<OwnerListingCheckoutPage />} />
          <Route path="subscription" element={<OwnerSubscription />} />
          <Route path="advertising" element={<Navigate to="/owner" replace />} />
          {/* legacy redirects */}
          <Route path="stats" element={<Navigate to="/owner/analytics" replace />} />
          <Route path="plan" element={<Navigate to="/owner/subscription" replace />} />
          <Route path="ads" element={<Navigate to="/owner" replace />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Route>
      </Routes>
    </RequireRole>
  );
}
