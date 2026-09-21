import DonateForm from './DonateForm';
import './SupportProjectSection.css';

/**
 * Homepage “Поддержите проект” block (kept as-is for the main feed).
 */
export default function SupportProjectSection({ config = {} }) {
  const title = config.title || 'Поддержите проект';
  const description =
    config.description ||
    'Сайт развивается на энтузиазме. Любая сумма помогает держать сервер, карту и каталог водоёмов.';

  return (
    <section
      className="page-section page-section--alt support-project"
      aria-labelledby="support-project-title"
    >
      <div className="section-inner support-project__inner">
        <div className="support-project__copy">
          <h2 id="support-project-title" className="section-head__title">
            {title}
          </h2>
          <p className="section-head__desc">{description}</p>
        </div>

        <div className="support-project__panel">
          <DonateForm
            config={config}
            note="Оплата через ЮKassa. После оплаты вы вернётесь на страницу благодарности."
          />
        </div>
      </div>
    </section>
  );
}
