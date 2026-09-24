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
 * Рекламные боковые баннеры (surface=forum) сохраняются.
 */
export default function EgorychPage() {
  return (
    <div className="egorych-page">
      <TimewebAgentEmbed />

      <header className="egorych-hero">
        <div className="egorych-hero__inner">
          <img
            className="egorych-hero__logo"
            src="/img/egorych.png"
            alt="Егорыч"
            width={220}
            height={220}
            decoding="async"
          />
          <div className="egorych-hero__text">
            <p className="egorych-hero__eyebrow">Помощник сайта</p>
            <h1>Егорыч</h1>
            <p className="egorych-hero__lead">
              Спроси, куда поехать на рыбалку, где купить червей или на что ловить судака —
              подскажу места, базы и магазины с нашего сайта.
            </p>
          </div>
        </div>
      </header>

      <SideBannerRails surface="forum">
        <div className="egorych-wrap">
          <section className="egorych-card">
            <h2>Как спросить</h2>
            <p>
              Открой чат Егорыча в правом нижнем углу экрана и напиши вопрос своими словами.
              Он опирается на каталог баз, водоёмов и справочник магазинов / сервисов / гидов.
            </p>
            <ul className="egorych-examples">
              {EXAMPLES.map((q) => (
                <li key={q}>
                  <span>«{q}»</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="egorych-card egorych-card--hint">
            <img src="/img/egorych.png" alt="" width={72} height={72} decoding="async" />
            <div>
              <h2>Чат уже на странице</h2>
              <p>
                Нажми на виджет Егорыча в углу — и пиши. Ответы со ссылками на карточки нашего
                сайта: базы, места и магазины.
              </p>
            </div>
          </section>
        </div>
      </SideBannerRails>
    </div>
  );
}
