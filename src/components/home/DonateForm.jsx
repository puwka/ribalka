import { useEffect, useState } from 'react';
import { api, apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import './DonateForm.css';

const DEFAULT_AMOUNTS = [50, 100, 300, 500];
const SCENIC_AMOUNTS = [300, 600, 1200];

/**
 * Shared YooKassa donate form (homepage scenic panel + /support page).
 */
export default function DonateForm({
  config = {},
  note = 'Оплата через ЮKassa. После оплаты откроется страница благодарности.',
  returnPath = '/support/thanks',
  variant = 'default',
}) {
  const scenic = variant === 'scenic';
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const amounts =
    Array.isArray(config.amounts) && config.amounts.length
      ? config.amounts.map(Number).filter((n) => n > 0)
      : scenic
        ? SCENIC_AMOUNTS
        : DEFAULT_AMOUNTS;
  const externalUrl = String(config.externalUrl || import.meta.env.VITE_DONATE_URL || '').trim();

  const [amount, setAmount] = useState(amounts[1] || amounts[0] || 100);
  const [custom, setCustom] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromProfile = profile?.email || user?.email || '';
    if (fromProfile) setEmail(fromProfile);
    const dn = profile?.display_name || profile?.displayName || '';
    if (dn) setName(dn);
  }, [profile?.email, profile?.display_name, profile?.displayName, user?.email]);

  const resolvedAmount = custom.trim() ? Math.round(Number(custom)) : amount;

  const onDonate = async () => {
    if (externalUrl) {
      window.location.href = externalUrl;
      return;
    }
    if (!apiDataEnabled) {
      showToast('Оплата доступна на боевом сайте', { type: 'info' });
      return;
    }
    if (!Number.isFinite(resolvedAmount) || resolvedAmount < 10) {
      showToast('Минимальная сумма — 10 ₽', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const data = await api.post('/api/payments/donate', {
        amount: resolvedAmount,
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        comment: comment.trim() || undefined,
        returnPath,
      });
      if (data?.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
      showToast('Не удалось получить ссылку на оплату', { type: 'error' });
    } catch (err) {
      showToast(err.message || 'Не удалось начать оплату', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (externalUrl) {
    return (
      <div className={`donate-form${scenic ? ' donate-form--scenic' : ''}`}>
        <a className="btn btn--primary donate-form__submit" href={externalUrl}>
          Пожертвовать
        </a>
      </div>
    );
  }

  if (!scenic) {
    return (
      <div className="donate-form">
        <div className="donate-form__amounts" role="group" aria-label="Сумма">
          {amounts.map((n) => (
            <button
              key={n}
              type="button"
              className={
                !custom && amount === n
                  ? 'donate-form__chip donate-form__chip--active'
                  : 'donate-form__chip'
              }
              onClick={() => {
                setAmount(n);
                setCustom('');
              }}
            >
              {n} ₽
            </button>
          ))}
        </div>

        <label className="donate-form__field">
          <span>Своя сумма, ₽</span>
          <input
            type="number"
            min={10}
            max={100000}
            inputMode="numeric"
            placeholder="Например, 30"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </label>

        <label className="donate-form__field">
          <span>Email для чека</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn--primary donate-form__submit"
          disabled={busy}
          onClick={onDonate}
        >
          {busy ? 'Переход к оплате…' : `Пожертвовать ${resolvedAmount || '…'} ₽`}
        </button>
        {note ? <p className="donate-form__note">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="donate-form donate-form--scenic">
      <header className="donate-form__head">
        <span className="donate-form__sprout" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 21v-8M12 13c-4-1-7-4-7-8 4 0 7 3 7 8zm0 0c4-1 7-4 7-8-4 0-7 3-7 8z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3 className="donate-form__title">Поддержка проекта</h3>
      </header>

      <label className="donate-form__field donate-form__field--icon">
        <span>Имя</span>
        <span className="donate-form__input-wrap">
          <span className="donate-form__ico" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </span>
      </label>

      <label className="donate-form__field donate-form__field--icon">
        <span>Электронная почта</span>
        <span className="donate-form__input-wrap">
          <span className="donate-form__ico" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <input
            type="email"
            autoComplete="email"
            placeholder="example@mail.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </span>
      </label>

      <div className="donate-form__block" role="group" aria-label="Сумма взноса">
        <span className="donate-form__label">Сумма взноса</span>
        <div className="donate-form__amounts">
          {amounts.map((n) => (
            <button
              key={n}
              type="button"
              className={
                !customOpen && !custom && amount === n
                  ? 'donate-form__chip donate-form__chip--active'
                  : 'donate-form__chip'
              }
              onClick={() => {
                setAmount(n);
                setCustom('');
                setCustomOpen(false);
              }}
            >
              {n} ₽
            </button>
          ))}
          <button
            type="button"
            className={
              customOpen || custom
                ? 'donate-form__chip donate-form__chip--other donate-form__chip--active'
                : 'donate-form__chip donate-form__chip--other'
            }
            onClick={() => setCustomOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                d="M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Другая сумма
          </button>
        </div>
        {customOpen || custom ? (
          <input
            className="donate-form__custom"
            type="number"
            min={10}
            max={100000}
            inputMode="numeric"
            placeholder="Введите сумму, ₽"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        ) : null}
      </div>

      <div className="donate-form__block" aria-label="Способ оплаты">
        <span className="donate-form__label">Способ оплаты</span>
        <div className="donate-form__method donate-form__method--active donate-form__method--solo">
          <strong>Банковская карта</strong>
          <span className="donate-form__brands" aria-hidden="true">
            <span>VISA</span>
            <span>MC</span>
            <span>МИР</span>
          </span>
        </div>
      </div>

      <label className="donate-form__field">
        <span>Комментарий</span>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="По желанию — пара слов проекту"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <span className="donate-form__counter">{comment.length}/500</span>
      </label>

      <button
        type="button"
        className="donate-form__cta"
        disabled={busy}
        onClick={onDonate}
      >
        <span aria-hidden="true">♡</span>
        {busy ? 'Переход к оплате…' : 'Поддержать сейчас'}
        <span aria-hidden="true">→</span>
      </button>

      <ul className="donate-form__foot" aria-label="Гарантии">
        <li>100% безопасно</li>
        <li>Надёжные системы</li>
        <li>Вы помогаете природе</li>
      </ul>
    </div>
  );
}
