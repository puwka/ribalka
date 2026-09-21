import { useEffect, useState } from 'react';
import { api, apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import './DonateForm.css';

const DEFAULT_AMOUNTS = [50, 100, 300, 500];

/**
 * Shared YooKassa donate form (homepage block + /support page).
 */
export default function DonateForm({
  config = {},
  note = 'Оплата через ЮKassa. После оплаты откроется страница благодарности.',
  returnPath = '/support/thanks',
}) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const amounts =
    Array.isArray(config.amounts) && config.amounts.length
      ? config.amounts.map(Number).filter((n) => n > 0)
      : DEFAULT_AMOUNTS;
  const externalUrl = String(config.externalUrl || import.meta.env.VITE_DONATE_URL || '').trim();

  const [amount, setAmount] = useState(amounts[1] || amounts[0] || 100);
  const [custom, setCustom] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromProfile = profile?.email || user?.email || '';
    if (fromProfile) setEmail(fromProfile);
  }, [profile?.email, user?.email]);

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
      <div className="donate-form">
        <a className="btn btn--primary donate-form__submit" href={externalUrl}>
          Пожертвовать
        </a>
      </div>
    );
  }

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
