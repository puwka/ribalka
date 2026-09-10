import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useCmsSettings, useCmsFooter } from '../../hooks/useCms';
import PermDateTime from '../PermDateTime/PermDateTime';
import Logo from '../Logo/Logo';
import './Footer.css';

export default function Footer() {
  const { handleClick } = useSmartNavigation();
  const { data: settings } = useCmsSettings();
  const { data: footer } = useCmsFooter();

  const brandText = footer?.brandText || settings?.tagline || '';
  const siteName = settings?.siteName || 'Рыбалка в Прикамье';
  const sponsors = (settings?.sponsors || []).map((s) => {
    const label = String(s?.label || '').trim();
    // Align display with domain-style labels (CMS may still store short name)
    if (label === 'Енот-мани' || label === 'Енот мани') {
      return { ...s, label: 'Енот-мани.рф' };
    }
    return s;
  });
  const socialRaw = settings?.social || {};
  // Prefer real project channels even if CMS still has placeholder URLs
  const social = {
    max:
      !socialRaw.max ||
      socialRaw.max === 'https://max.ru' ||
      socialRaw.max === 'https://max.ru/'
        ? 'https://max.ru/channel_aktiv59'
        : socialRaw.max,
    telegram:
      !socialRaw.telegram ||
      socialRaw.telegram === 'https://t.me/' ||
      socialRaw.telegram === 'https://t.me'
        ? 'https://t.me/aktiv59ru'
        : socialRaw.telegram,
    vk:
      !socialRaw.vk ||
      socialRaw.vk === 'https://vk.com' ||
      socialRaw.vk === 'https://vk.com/'
        ? 'https://vk.ru/aktiv59ru'
        : socialRaw.vk,
  };

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
          <Logo to="/" variant="on-dark" />
          <p>{brandText}</p>
          
          {footer?.showDateTime !== false && <PermDateTime />}
          
          {footer?.showSponsors !== false && sponsors.length > 0 && (
          <div className="footer__sponsors-block">
            <span className="sponsors-text">Сайт работает при поддержке</span>
            <div className="sponsors-links">
              {sponsors.map((s, i) => (
                <a
                  key={s.url || s.label || i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sponsor-link-item"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          )}
          
          {footer?.showSocial !== false && (
          <div className="footer__social">
            {social.max && (
            <a href={social.max} target="_blank" rel="noopener noreferrer" className="social-link social-link--max" aria-label="MAX">
              <img src="/img/social/max.png" alt="" width={40} height={40} />
            </a>
            )}
            {social.telegram && (
            <a href={social.telegram} target="_blank" rel="noopener noreferrer" className="social-link social-link--telegram" aria-label="Telegram">
              <img src="/img/social/telegram.png" alt="" width={40} height={40} />
            </a>
            )}
            {social.vk && (
            <a href={social.vk} target="_blank" rel="noopener noreferrer" className="social-link social-link--vk" aria-label="ВКонтакте">
              <img src="/img/social/vk.png" alt="" width={40} height={40} />
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