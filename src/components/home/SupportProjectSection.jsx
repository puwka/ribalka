import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import './SupportProjectSection.css';

const DEFAULT_AMOUNTS = [50, 100, 300, 500];

/**
 * Homepage “Поддержите проект” — YooKassa donate via API or external payment link.
 */
export default function SupportProjectSection({ config = {} }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const title = config.title || 'Поддержите проект';
  const description =
    config.description ||
    'Сайт развивается на энтузиазме. Любая сумма помогает держать сервер, карту и каталог водоёмов.';
  const amounts = Array.isArray(config.amounts) && config.amounts.length
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

  useEffect(() => {
    if (params.get('donated') !== '1') return;
    try {
      if (sessionStorage.getItem('donate_thanks') === '1') {
        const next = new URLSearchParams(params);
        next.delete('donated');
        setParams(next, { replace: true });
        return;
      }
      sessionStorage.setItem('donate_thanks', '1');
    } catch {
      /* ignore */
    }
    showToast('Спасибо за поддержку проекта!', { type: 'success' });
    const next = new URLSearchParams(params);
    next.delete('donated');
    setParams(next, { replace: true });
  }, [params, setParams, showToast]);

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
      try {
        sessionStorage.removeItem('donate_thanks');
      } catch {
        /* ignore */
      }
      const data = await api.post('/api/payments/donate', {
        amount: resolvedAmount,
        email: email.trim() || undefined,
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

  return (
    <section className="page-section page-section--alt support-project" aria-labelledby="support-project-title">
      <div className="section-inner support-project__inner">
        <div className="support-project__copy">
          <h2 id="support-project-title" className="section-head__title">
            {title}
          </h2>
          <p className="section-head__desc">{description}</p>
        </div>

        <div className="support-project__panel">
          {externalUrl ? (
            <a className="btn btn--primary support-project__submit" href={externalUrl}>
              Пожертвовать
            </a>
          ) : (
            <>
              <div className="support-project__amounts" role="group" aria-label="Сумма">
                {amounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={
                      !custom && amount === n
                        ? 'support-project__chip support-project__chip--active'
                        : 'support-project__chip'
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

              <label className="support-project__field">
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

              <label className="support-project__field">
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
                className="btn btn--primary support-project__submit"
                disabled={busy}
                onClick={onDonate}
              >
                {busy ? 'Переход к оплате…' : `Пожертвовать ${resolvedAmount || '…'} ₽`}
              </button>
              <p className="support-project__note">
                Оплата через ЮKassa. После оплаты вы вернётесь на главную.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
