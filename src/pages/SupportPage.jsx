import { Link } from 'react-router-dom';
import DonateForm from '../components/home/DonateForm';
import './SupportPage.css';

export default function SupportPage() {
  return (
    <div className="support-page">
      <div className="section-inner support-page__inner">
        <div className="support-page__hero">
          <div className="support-page__art">
            <img src="/img/support-handshake.jpg" alt="" width={120} height={120} />
          </div>
          <div className="support-page__copy">
            <h1>Поддержите проект</h1>
            <p>
              Здравствуйте! Если вы желаете поддержать проект — будем вам очень признательны. В
              данный момент проект развивается на энтузиазме нашей семьи.
            </p>
          </div>
        </div>

        <div className="support-page__panel">
          <DonateForm />
        </div>

        <p className="support-page__back">
          <Link to="/">← На главную</Link>
        </p>
      </div>
    </div>
  );
}
