import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiDataEnabled } from '../lib/apiClient';
import { useAuth } from '../components/auth/AuthContext';
import '../components/auth/AuthShared.css';

const WD_RU = {
  pending: 'На модерации',
  paid: 'Выплачено',
  rejected: 'Отклонено',
};

function formatMoney(n) {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function CabinetBalancePanel() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [contests, setContests] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [card, setCard] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!apiDataEnabled) {
      setError('Баланс доступен при работе через API');
      return;
    }
    setError('');
    try {
      const [wallet, list] = await Promise.all([
        api.get('/api/contests/wallet/me'),
        api.get('/api/contests'),
      ]);
      setData(wallet);
      setContests(list || []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить баланс');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const withdraw = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      await api.post('/api/contests/wallet/withdraw', {
        amount_rub: Number(amount),
        card_details: card.trim(),
      });
      setAmount('');
      setCard('');
      setMessage('Заявка на вывод отправлена. После перевода на карту статус обновится.');
      await load();
      await refresh();
    } catch (err) {
      setError(err.message || 'Ошибка заявки');
    } finally {
      setSending(false);
    }
  };

  const balance = data?.balance_rub ?? 0;

  return (
    <div className="cabinet-panel">
      <h2>Баланс и конкурсы</h2>
      <p className="cabinet-panel__lead">
        Призы за конкурсы отчётов и месячный рейтинг отзывов/комментариев зачисляются сюда
        автоматически. Вывод — на карту после модерации.
      </p>

      {error && <div className="auth-error">{error}</div>}
      {message && <div className="ntf-page__msg">{message}</div>}

      <div className="cabinet-metrics">
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Доступно</div>
          <div className="cabinet-metric__value">{formatMoney(balance)}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Призов</div>
          <div className="cabinet-metric__value">{data?.awards?.length ?? 0}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Заявок на вывод</div>
          <div className="cabinet-metric__value">{data?.withdrawals?.length ?? 0}</div>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h3>Вывести на карту</h3>
        <form onSubmit={withdraw} className="cabinet-form" style={{ maxWidth: 480 }}>
          <label>
            Сумма, ₽ (мин. 100)
            <input
              type="number"
              min="100"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Реквизиты карты и ФИО получателя
            <textarea
              rows={3}
              required
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder={'2200 **** **** 1234\nИванов Иван Иванович'}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={sending || balance < 100}>
            {sending ? 'Отправка…' : 'Подать заявку'}
          </button>
        </form>
      </section>

      {(data?.awards || []).length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3>Мои призы</h3>
          <ul className="cabinet-list">
            {data.awards.map((a) => (
              <li key={a.id} className="cabinet-item">
                <div className="cabinet-item__title">
                  {a.place} место — {a.contest_title}
                </div>
                <div className="cabinet-item__meta">
                  {formatMoney(a.amount_rub)} · {formatWhen(a.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.withdrawals || []).length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3>Заявки на вывод</h3>
          <ul className="cabinet-list">
            {data.withdrawals.map((w) => (
              <li key={w.id} className="cabinet-item">
                <div className="cabinet-item__title">
                  {formatMoney(w.amount_rub)} · {WD_RU[w.status] || w.status}
                </div>
                <div className="cabinet-item__meta">
                  {w.card_masked} · {formatWhen(w.created_at)}
                  {w.admin_note ? (
                    <>
                      <br />
                      {w.admin_note}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.transactions || []).length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3>История операций</h3>
          <ul className="cabinet-list">
            {data.transactions.map((t) => (
              <li key={t.id} className="cabinet-item">
                <div className="cabinet-item__title">{t.title || t.kind}</div>
                <div className="cabinet-item__meta">
                  {Number(t.amount_rub) > 0 ? '+' : ''}
                  {formatMoney(t.amount_rub)} · {formatWhen(t.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h3>Активные конкурсы</h3>
        <p className="cabinet-panel__lead">
          <Link to="/ranking">Рейтинг рыбаков Пермского края →</Link>
        </p>
        {!contests.length ? (
          <p className="cabinet-panel__lead">Сейчас нет активных розыгрышей</p>
        ) : (
          <ul className="cabinet-list">
            {contests.map((c) => (
              <li key={c.id} className="cabinet-item">
                <div className="cabinet-item__title">{c.title}</div>
                <div className="cabinet-item__meta">
                  {c.type === 'reports' ? 'Отчёты' : 'Отзывы и комментарии'} · {c.status}
                  <br />
                  до {formatWhen(c.ends_at)}
                  <br />
                  Призы:{' '}
                  {(c.prizes || [])
                    .map((p) => `${p.place} — ${formatMoney(p.amount_rub)}`)
                    .join(', ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
