import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useCmsSettings, useCmsFooter } from '../../hooks/useCms';
import PermDateTime from '../PermDateTime/PermDateTime';
import './Footer.css';

export default function Footer() {
  const { handleClick } = useSmartNavigation();
  const { data: settings } = useCmsSettings();
  const { data: footer } = useCmsFooter();

  const siteName = settings?.siteName || 'Рыбалка в Прикамье';
  const brandText = footer?.brandText || settings?.tagline || '';
  const sponsors = settings?.sponsors || [];
  const social = settings?.social || {};

  const openModal = (modalType) => {
    const button = document.getElementById(`open${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`);
    if (button) button.click();
  };

  // Универсальный обработчик для всех ссылок
  const onFooterClick = (e, target) => {
    handleClick(e, target);
  };

  return (
    <footer className="footer" id="contacts">
      <div className="footer__container">
        {/* БРЕНД */}
        <div className="footer__brand">
          <div className="footer__logo">
            <span className="footer__logo-text">{siteName}</span>
          </div>
          <p>{brandText}</p>
          
          {footer?.showDateTime !== false && <PermDateTime />}
          
          {footer?.showSponsors !== false && sponsors.length > 0 && (
          <div className="footer__sponsors-block">
            <span className="sponsors-text">Сайт работает при поддержке</span>
            <div className="sponsors-links">
              {sponsors.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && <span className="sponsors-divider">и</span>}
                  <a 
                    href={s.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="sponsor-link-item"
                  >
                    {s.label}
                  </a>
                </span>
              ))}
            </div>
          </div>
          )}
          
          {footer?.showSocial !== false && (
          <div className="footer__social">
            {social.max && (
            <a href={social.max} target="_blank" rel="noopener noreferrer" className="social-link social-link--max" aria-label="MAX">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 4.5C2 3.67 2.67 3 3.5 3h17C21.33 3 22 3.67 22 4.5v15c0 .83-.67 1.5-1.5 1.5h-17C2.67 21 2 20.33 2 19.5v-15zM6.5 16.5h2l1.5-3.5 1.5 3.5h2v-7h-1.8v4.2L10.3 10h-1.6l-1.4 3.7V10H6.5v6.5zm8 0h3.5v-1.3h-1.7V10H14.5v6.5z"/>
              </svg>
            </a>
            )}
            {social.telegram && (
            <a href={social.telegram} target="_blank" rel="noopener noreferrer" className="social-link social-link--telegram" aria-label="Telegram">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            )}
            {social.vk && (
            <a href={social.vk} target="_blank" rel="noopener noreferrer" className="social-link social-link--vk" aria-label="ВКонтакте">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.27-1.422 2.18-3.61 2.18-3.61.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.49-.085.744-.576.744z"/>
              </svg>
            </a>
            )}
          </div>
          )}
        </div>

        {/* МЕНЮ */}
        <div className="footer__column">
          <h4>Меню</h4>
          <ul>
            <li><a href="/" onClick={(e) => onFooterClick(e, '/')}>Главная</a></li>
            <li><a href="/paid-waters" onClick={(e) => onFooterClick(e, '/paid-waters')}>Платные водоёмы</a></li>
            <li><a href="/free-waters" onClick={(e) => onFooterClick(e, '/free-waters')}>Бесплатные водоёмы</a></li>
            <li><a href="/map" onClick={(e) => onFooterClick(e, '/map')}>Карта</a></li>
            <li><a href="/calendar" onClick={(e) => onFooterClick(e, '/calendar')}>Календарь рыболова</a></li>
            <li><a href="/lunar" onClick={(e) => onFooterClick(e, '/lunar')}>Лунный календарь</a></li>
            <li><a href="/directory" onClick={(e) => onFooterClick(e, '/directory')}>Справочник</a></li>
            <li><a href="/reports" onClick={(e) => onFooterClick(e, '/reports')}>Отчёты о рыбалке</a></li>
            <li><a href="/forum" onClick={(e) => onFooterClick(e, '/forum')}>Форум</a></li>
            <li><a href="#news" onClick={(e) => onFooterClick(e, '#news')}>Новости</a></li>
            <li><a href="/about" onClick={(e) => onFooterClick(e, '/about')}>О нас</a></li>
          </ul>
        </div>

        {/* ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ */}
        <div className="footer__column footer__column--wide">
          <h4>Юридическая информация</h4>
          <div className="footer__legal">
            <div className="legal-item">
              <span className="legal-label">ОГРНИП:</span>
              <span className="legal-value">{settings?.legalOgrnip || '—'}</span>
            </div>
            <div className="legal-item">
              <span className="legal-label">ИНН:</span>
              <span className="legal-value">{settings?.legalInn || '—'}</span>
            </div>
            <div className="legal-item">
              <span className="legal-label">Email для связи:</span>
              <a href={`mailto:${settings?.contactEmail || ''}`} className="legal-value legal-link">{settings?.contactEmail || '—'}</a>
            </div>
          </div>
        </div>
      </div>

      {/* НИЖНЯЯ ЧАСТЬ */}
      <div className="footer__bottom">
        <div className="footer__bottom-content">
          <div className="footer__links">
            <a href="#privacy" onClick={(e) => { e.preventDefault(); openModal('privacy'); }} className="footer-link">
              Политика конфиденциальности
            </a>
            <span className="footer-link-divider">•</span>
            <a href="#terms" onClick={(e) => { e.preventDefault(); openModal('terms'); }} className="footer-link">
              Пользовательское соглашение
            </a>
          </div>
          
          <div className="footer__copy">
            © {new Date().getFullYear()} {siteName}. Все права защищены.
          </div>
        </div>
      </div>
    </footer>
  );
}