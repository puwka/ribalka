import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './SupportPage.css';

const REDIRECT_SEC = 8;

export default function SupportThanksPage() {
  const navigate = useNavigate();
  const [left, setLeft] = useState(REDIRECT_SEC);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const remain = Math.max(0, REDIRECT_SEC - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        clearInterval(tick);
        navigate('/', { replace: true });
      }
    }, 250);
    return () => clearInterval(tick);
  }, [navigate]);

  return (
    <div className="support-page support-thanks">
      <div className="section-inner support-page__inner">
        <div className="support-thanks__card">
          <div className="support-page__art support-thanks__art">
            <img src="/img/support-handshake.jpg" alt="" width={100} height={100} />
          </div>
          <h1>Благодарим вас за поддержку проекта</h1>
          <p>Будем рады видеть вас на нашем сайте!</p>
          <p className="support-thanks__timer">
            Через {left} сек. откроется главная — или{' '}
            <Link to="/">перейдите сейчас</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
