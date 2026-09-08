import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listingPaymentService } from '../services/listingPaymentService';
import './DirectoryPage.css';

export default function DirectoryPaymentResultPage() {
  const { orderId } = useParams();
  const [state, setState] = useState({ phase: 'checking', order: null, error: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await listingPaymentService.verifyDirectoryOrder(orderId);
        if (!alive) return;
        setState({
          phase: result.paid || result.order?.status === 'paid' ? 'paid' : 'pending',
          order: result.order,
          error: '',
        });
      } catch (err) {
        if (alive) setState({ phase: 'error', order: null, error: err.message || 'Ошибка' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  return (
    <div className="directory-page">
      <div className="directory-container" style={{ paddingTop: '2rem' }}>
        <h1>Оплата размещения в справочнике</h1>
        {state.phase === 'checking' && <p>Проверяем оплату…</p>}
        {state.phase === 'paid' && (
          <>
            <p>Оплата получена. Заявка отправлена на модерацию и появится в справочнике после проверки.</p>
            <p>
              <Link to="/directory">← К справочнику</Link>
            </p>
          </>
        )}
        {state.phase === 'pending' && (
          <>
            <p>Платёж ещё обрабатывается. Обновите страницу через минуту или проверьте кабинет уведомлений.</p>
            <p>
              Заказ: <code>{orderId}</code>
            </p>
            <p>
              <Link to="/directory">← К справочнику</Link>
            </p>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <p style={{ color: '#b91c1c' }}>{state.error}</p>
            <Link to="/directory">← К справочнику</Link>
          </>
        )}
      </div>
    </div>
  );
}
