import SideBannerRails from '../components/ads/SideBannerRails';
import TimewebAgentEmbed from '../components/egorych/TimewebAgentEmbed';
import './EgorychPage.css';

const EXAMPLES = [
  'Куда съездить на рыбалку в выходные?',
  'Где купить червей и наживку?',
  'На что ловить судака?',
  'Какие базы отдыха есть у реки?',
  'Подскажи магазин снастей рядом',
];

/**
 * Егорыч — AI-помощник вместо форума.
 * Чат Timeweb встроен прямо в страницу; рекламные баннеры (surface=forum) сохраняются.
 */
export default function EgorychPage() {
  return (
    <div className="egorych-page">
      <header className="egorych-hero">
        <div className="egorych-hero__inner">
          <img
            className="egorych-hero__logo"
            src="/img/egorych.png"
            alt="Егорыч"
            width={160}
            height={160}
            decoding="async"
          />
          <div className="egorych-hero__text">
            <p className="egorych-hero__eyebrow">Помощник сайта</p>
            <h1>Егорыч</h1>
            <p className="egorych-hero__lead">
              Спроси прямо здесь: куда поехать на рыбалку, где купить червей или на что ловить
              судака — подскажу места, базы и магазины с нашего сайта.
            </p>
          </div>
        </div>
      </header>

      <SideBannerRails surface="forum">
        <div className="egorych-wrap">
          <section className="egorych-chat-panel" aria-label="Диалог с Егорычем">
            <TimewebAgentEmbed open showButton={false} />
          </section>

          <section className="egorych-card">
            <h2>Примеры вопросов</h2>
            <p>Напишите своими словами в чате выше — например:</p>
            <ul className="egorych-examples">
              {EXAMPLES.map((q) => (
                <li key={q}>
                  <span>«{q}»</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SideBannerRails>
    </div>
  );
}
