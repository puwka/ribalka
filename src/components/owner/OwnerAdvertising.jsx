import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { advertisingService } from '../../services/advertisingService';
import { uploadService } from '../../services/uploadService';
import { formatRub } from '../../lib/directoryPricing';
import '../auth/AuthShared.css';
import './OwnerMonetization.css';

const EMPTY_FORM = {
  title: '',
  target_url: '',
  image_url: '',
  placement: 'right',
  surface: 'news',
  days: 1,
};

const SURFACE_RU = { news: 'Новости', forum: 'Егорыч' };

function formatEnds(ad) {
  if (!ad?.ends_at) return null;
  try {
    return new Date(ad.ends_at).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function isTermEnded(ad) {
  if (!ad) return false;
  if (ad.status === 'expired') return true;
  if (!ad.ends_at) return false;
  const t = new Date(ad.ends_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function displayStatus(ad, statusLabels) {
  if (isTermEnded(ad)) return 'Срок истёк';
  return statusLabels[ad.status] || ad.status;
}

export default function OwnerAdvertisingPanel() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [price, setPrice] = useState({ amount: 300, unit: 'day' });
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const [list, p, s] = await Promise.all([
      advertisingService.listMine(user.id),
      advertisingService.getSidebarPrice().catch(() => ({ amount: 300, unit: 'day' })),
      advertisingService.getSlots().catch(() => null),
    ]);
    setItems(list);
    setPrice(p);
    setSlots(s);
  };

  useEffect(() => {
    if (!user?.id) return;
    load().catch((err) => setError(err.message));
  }, [user?.id]);

  useEffect(() => {
    const surf = searchParams.get('surface');
    if (surf === 'forum' || surf === 'news') {
      setForm((f) => ({ ...f, surface: surf }));
    }
  }, [searchParams]);

  useEffect(() => {
    const paidId = searchParams.get('paid');
    if (!paidId || !user?.id) return;

    let alive = true;
    (async () => {
      try {
        const ad = await advertisingService.verify(user.id, paidId);
        if (!alive) return;
        const reallyPaid =
          Boolean(ad?.paid_at) ||
          ['pending', 'active', 'paused'].includes(String(ad?.status || ''));
        if (reallyPaid) {
          setError('');
          setMessage(
            'Оплата принята — баннер на модерации. После проверки он появится в выбранном разделе.'
          );
        } else {
          setMessage('');
          setError(
            'Оплата не завершена. Если деньги списались — подождите минуту и обновите страницу, либо нажмите «Оплатить» у черновика.'
          );
        }
        await load().catch(() => {});
      } catch (err) {
        if (!alive) return;
        setMessage('');
        setError(err.message || 'Не удалось подтвердить оплату');
      } finally {
        if (!alive) return;
        const next = new URLSearchParams(searchParams);
        if (next.has('paid')) {
          next.delete('paid');
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [searchParams, user?.id, setSearchParams]);

  const dayPrice = Number(price.amount) || 300;
  const days = Math.max(1, Math.min(365, Math.round(Number(form.days) || 1)));
  const total = Math.round(dayPrice * days);
  const isEditing = Boolean(editingId);

  const slotHint = useMemo(() => {
    const block = slots?.slots?.[form.surface]?.[form.placement];
    if (!block) return null;
    return `Свободно: ${block.free} из ${block.total} (${SURFACE_RU[form.surface]}, ${
      form.placement === 'left' ? 'слева' : 'справа'
    })`;
  }, [slots, form.surface, form.placement]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadService.uploadImage(file, {
        userId: user.id,
        bucket: uploadService.buckets.site,
      });
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(err.message || 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title || '',
      target_url: ad.target_url || ad.targetUrl || '',
      image_url: ad.image_url || ad.imageUrl || '',
      placement: ad.placement === 'left' ? 'left' : 'right',
      surface: ad.surface === 'forum' ? 'forum' : 'news',
      days: Number(ad.days) || 1,
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createAndPay = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const ad = await advertisingService.createSidebarBanner(user.id, { ...form, days });
      const result = await advertisingService.checkout(user.id, ad.id);
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      resetForm();
      setMessage('Заявка оплачена и отправлена на модерацию.');
      await load();
    } catch (err) {
      setError(err.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await advertisingService.updateMine(user.id, editingId, { ...form, days });
      resetForm();
      setMessage('Изменения сохранены и отправлены на модерацию.');
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const payExisting = async (adId) => {
    setSaving(true);
    setError('');
    try {
      const result = await advertisingService.checkout(user.id, adId);
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      setMessage('Отправлено на модерацию.');
      await load();
    } catch (err) {
      setError(err.message || 'Ошибка оплаты');
    } finally {
      setSaving(false);
    }
  };

  const removeAd = async (adId) => {
    if (!window.confirm('Удалить этот баннер?')) return;
    setSaving(true);
    setError('');
    try {
      await advertisingService.deleteMine(user.id, adId);
      if (editingId === adId) resetForm();
      setMessage('Баннер удалён.');
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось удалить');
    } finally {
      setSaving(false);
    }
  };

  const statusLabels = advertisingService.statusLabels || {};
  const editingAd = items.find((a) => a.id === editingId);
  const canChangeDays = !isEditing || !editingAd?.paid_at || isTermEnded(editingAd);

  return (
    <div className="cabinet-panel mon-panel">
      <h2>Реклама на сайте</h2>
      <p className="cabinet-panel__lead">
        Боковые баннеры на <strong>новостях</strong> или <strong>форуме</strong>: по 4 места
        (2 слева + 2 справа). Рекомендуемый размер изображения — <strong>200×300</strong> px
        (вертикальный). Стоимость — <strong>{formatRub(dayPrice)}</strong> за сутки; срок
        указываете сами. После оплаты — модерация; любое изменение снова отправляет баннер на
        проверку.
      </p>
      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-success">{message}</div>}

      <form
        className="cabinet-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isEditing) saveEdit();
          else createAndPay();
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
          {isEditing ? 'Редактировать баннер' : 'Новый баннер'}
        </h3>
        <label>
          Название *
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Например: База отдыха Урал"
          />
        </label>
        <label>
          Ссылка по клику *
          <input
            required
            type="url"
            value={form.target_url}
            onChange={(e) => setForm({ ...form, target_url: e.target.value })}
            placeholder="https://"
          />
        </label>
        <label>
          Раздел сайта *
          <select
            value={form.surface}
            onChange={(e) => setForm({ ...form, surface: e.target.value })}
          >
            <option value="news">Новости</option>
            <option value="forum">Егорыч</option>
          </select>
        </label>
        <label>
          Сторона *
          <select
            value={form.placement}
            onChange={(e) => setForm({ ...form, placement: e.target.value })}
          >
            <option value="right">Справа</option>
            <option value="left">Слева</option>
          </select>
        </label>
        {slotHint ? (
          <p className="cabinet-panel__lead" style={{ marginTop: 0 }}>
            {slotHint}
          </p>
        ) : null}
        {canChangeDays ? (
          <label>
            Срок (сутки) *
            <input
              required
              type="number"
              min={1}
              max={365}
              step={1}
              value={form.days}
              onChange={(e) => setForm({ ...form, days: e.target.value })}
            />
          </label>
        ) : (
          <p className="cabinet-panel__lead">
            Срок: {Number(editingAd?.days) || days} сут. (уже оплачен)
          </p>
        )}
        <label>
          Баннер 200×300 *
          <input type="file" accept="image/*" onChange={onUpload} disabled={uploading} />
        </label>
        {form.image_url ? (
          <div style={{ marginTop: 8 }}>
            <img
              src={form.image_url}
              alt="Превью"
              style={{
                width: 100,
                height: 150,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            />
          </div>
        ) : null}

        {!isEditing ? (
          <p className="cabinet-panel__lead" style={{ marginTop: 8 }}>
            К оплате: <strong>{formatRub(total)}</strong>
            {` (${formatRub(dayPrice)} × ${days} сут.)`}
          </p>
        ) : (
          <p className="cabinet-panel__lead" style={{ marginTop: 8 }}>
            После сохранения баннер снова уйдёт на модерацию.
          </p>
        )}

        <div className="cabinet-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || uploading || !form.image_url}
          >
            {saving
              ? 'Сохраняем…'
              : isEditing
                ? 'Сохранить и на модерацию'
                : `Оплатить и на модерацию ${formatRub(total)}`}
          </button>
          {isEditing ? (
            <button type="button" className="btn-secondary" disabled={saving} onClick={resetForm}>
              Отмена
            </button>
          ) : null}
        </div>
      </form>

      <div className="cabinet-list" style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>Мои баннеры</h3>
        {!items.length ? (
          <p className="cabinet-panel__lead">Пока нет размещений.</p>
        ) : (
          items.map((ad) => {
            const views = Number(ad.views_count) || 0;
            const clicks = Number(ad.clicks_count) || 0;
            const ends = formatEnds(ad);
            const ended = isTermEnded(ad);
            const dayPrice = Number(price?.amount) || 300;
            const renewTotal = Math.round(dayPrice * Math.max(1, Number(ad.days) || 1));
            return (
              <div key={ad.id} className="cabinet-item">
                <div className="cabinet-item__title">
                  {ad.title} · {SURFACE_RU[ad.surface] || 'Новости'} ·{' '}
                  {ad.placement === 'left' ? 'слева' : 'справа'}
                </div>
                <div className="cabinet-item__meta">
                  <strong style={ended ? { color: '#b45309' } : undefined}>
                    {displayStatus(ad, statusLabels)}
                  </strong>
                  {ad.budget != null ? ` · ${formatRub(ad.budget)}` : ''}
                  {ad.days ? ` · ${ad.days} сут.` : ''}
                  {ends ? (ended ? ` · истёк ${ends}` : ` · до ${ends}`) : ''}
                  <br />
                  Просмотры: <strong>{views}</strong>
                  {' · '}
                  Клики: <strong>{clicks}</strong>
                  {ad.moderation_note ? (
                    <>
                      <br />
                      {ad.moderation_note}
                    </>
                  ) : null}
                </div>
                {ad.image_url || ad.imageUrl ? (
                  <img
                    src={ad.image_url || ad.imageUrl}
                    alt=""
                    style={{ width: 60, height: 90, objectFit: 'cover', marginTop: 8, borderRadius: 6 }}
                  />
                ) : null}
                <div className="cabinet-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => startEdit(ad)}
                  >
                    Изменить
                  </button>
                  {ended ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saving}
                      onClick={() => payExisting(ad.id)}
                    >
                      Продлить {formatRub(renewTotal)}
                    </button>
                  ) : null}
                  {(ad.status === 'draft' || ad.status === 'rejected') && !ended ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saving}
                      onClick={() => payExisting(ad.id)}
                    >
                      Оплатить / на модерацию
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => removeAd(ad.id)}
                    style={{ color: '#b91c1c' }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
