import { useEffect, useState } from 'react';
import './PwaInstallPrompt.css';

const DISMISS_KEY = 'pwa_install_dismissed_until';
const LAST_SHOWN_KEY = 'pwa_install_last_shown';
const DISMISS_MS = 90 * 24 * 60 * 60 * 1000;
const RESHOW_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 5000;

function readNum(key) {
  try {
    const n = Number(localStorage.getItem(key) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeNum(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function shouldOffer() {
  if (Date.now() < readNum(DISMISS_KEY)) return false;
  const last = readNum(LAST_SHOWN_KEY);
  return !last || Date.now() - last >= RESHOW_MS;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function cookiesAccepted() {
  try {
    return localStorage.getItem('cookieAccepted') === 'true';
  } catch {
    return true;
  }
}

function AppGlyph() {
  return (
    <svg className="pwa-prompt__glyph" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="6" width="48" height="52" rx="10" fill="currentColor" opacity="0.12" />
      <rect x="14" y="12" width="36" height="40" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="46" r="2.5" fill="currentColor" />
      <path
        d="M24 28c4-8 12-8 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [readyForPrompt, setReadyForPrompt] = useState(cookiesAccepted());

  useEffect(() => {
    const onCookie = () => setReadyForPrompt(true);
    window.addEventListener('cookie-accepted', onCookie);
    return () => window.removeEventListener('cookie-accepted', onCookie);
  }, []);

  useEffect(() => {
    if (!readyForPrompt || isStandalone() || !shouldOffer()) return;

    let timer = 0;
    let offered = false;
    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const reveal = () => {
      if (offered || isStandalone() || !shouldOffer()) return;
      offered = true;
      writeNum(LAST_SHOWN_KEY, Date.now());
      setVisible(true);
    };

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    timer = window.setTimeout(reveal, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, [readyForPrompt]);

  if (!visible) return null;

  const dismiss = () => {
    writeNum(DISMISS_KEY, Date.now() + DISMISS_MS);
    setVisible(false);
    setDeferred(null);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <section className="pwa-prompt" role="dialog" aria-labelledby="pwa-prompt-title">
      <div className="pwa-prompt__card">
        <button type="button" className="pwa-prompt__close" aria-label="Закрыть" onClick={dismiss}>
          ×
        </button>

        <div className="pwa-prompt__top">
          <div className="pwa-prompt__badge" aria-hidden="true">
            <AppGlyph />
          </div>
          <div>
            <p className="pwa-prompt__eyebrow">На домашний экран</p>
            <h2 id="pwa-prompt-title" className="pwa-prompt__title">
              Рыбалка всегда под рукой
            </h2>
          </div>
        </div>

        <p className="pwa-prompt__desc">
          {iosHint
            ? 'На iPhone: кнопка «Поделиться» → «На экран «Домой»» — и каталог водоёмов как приложение.'
            : 'Установите приложение: карта, базы и отчёты без лишних вкладок, удобный доступ с экрана телефона.'}
        </p>

        <ul className="pwa-prompt__perks">
          <li>Быстрый вход с иконки</li>
          <li>Удобнее на телефоне</li>
          <li>Работает как приложение</li>
        </ul>

        <div className="pwa-prompt__actions">
          {deferred ? (
            <button type="button" className="pwa-prompt__install" onClick={install}>
              Установить приложение
            </button>
          ) : iosHint ? (
            <button type="button" className="pwa-prompt__install" onClick={dismiss}>
              Понятно
            </button>
          ) : (
            <button type="button" className="pwa-prompt__install" onClick={dismiss}>
              Хорошо
            </button>
          )}
          <button type="button" className="pwa-prompt__later" onClick={dismiss}>
            Позже
          </button>
        </div>
      </div>
    </section>
  );
}
