import { useEffect, useState } from 'react';
import {
  consumePendingOpen,
  getState,
  isStandalone,
  promptPwaInstall,
  subscribePwaInstall,
} from '../../lib/pwaInstall';
import './PwaInstallPrompt.css';

const SNOOZE_KEY = 'pwa_install_snooze_until';
const HIDE_KEY = 'pwa_install_hide_until';
/** «Позже» — коротко, чтобы можно было увидеть снова */
const SNOOZE_MS = 2 * 24 * 60 * 60 * 1000;
/** Крестик / «Не сейчас» — ненадолго */
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3500;

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

function isSuppressed() {
  const now = Date.now();
  return now < readNum(SNOOZE_KEY) || now < readNum(HIDE_KEY);
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
  const [pwa, setPwa] = useState(getState);
  const [visible, setVisible] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [readyForPrompt, setReadyForPrompt] = useState(cookiesAccepted());

  useEffect(() => subscribePwaInstall(setPwa), []);

  useEffect(() => {
    const onCookie = () => setReadyForPrompt(true);
    const onOpen = () => {
      if (isStandalone()) return;
      setForceOpen(true);
      setVisible(true);
    };
    window.addEventListener('cookie-accepted', onCookie);
    window.addEventListener('pwa-open-install', onOpen);
    if (consumePendingOpen()) onOpen();
    return () => {
      window.removeEventListener('cookie-accepted', onCookie);
      window.removeEventListener('pwa-open-install', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!readyForPrompt || isStandalone() || forceOpen) return undefined;
    if (isSuppressed()) return undefined;

    // Show when we can install, or iOS hint (no BIP on Safari)
    const canShow = () => pwa.canPrompt || pwa.iosHint;
    if (!canShow()) return undefined;

    const timer = window.setTimeout(() => {
      if (isStandalone() || isSuppressed()) return;
      if (!getState().canPrompt && !getState().iosHint) return;
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [readyForPrompt, pwa.canPrompt, pwa.iosHint, forceOpen]);

  if (!visible || pwa.installed) return null;

  const snooze = () => {
    writeNum(SNOOZE_KEY, Date.now() + SNOOZE_MS);
    setForceOpen(false);
    setVisible(false);
  };

  const hideAwhile = () => {
    writeNum(HIDE_KEY, Date.now() + HIDE_MS);
    setForceOpen(false);
    setVisible(false);
  };

  const install = async () => {
    if (pwa.canPrompt) {
      await promptPwaInstall();
      setForceOpen(false);
      setVisible(false);
      return;
    }
    // iOS / no BIP yet — keep hint visible; user follows Share → Home Screen
  };

  return (
    <section className="pwa-prompt" role="dialog" aria-labelledby="pwa-prompt-title">
      <div className="pwa-prompt__card">
        <button type="button" className="pwa-prompt__close" aria-label="Закрыть" onClick={hideAwhile}>
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
          {pwa.iosHint
            ? 'На iPhone: кнопка «Поделиться» → «На экран «Домой»» — каталог и карта как приложение, в том числе офлайн.'
            : pwa.canPrompt
              ? 'Установите приложение: карта, базы, отчёты и офлайн-доступ с иконки на телефоне.'
              : 'Добавьте сайт на домашний экран через меню браузера (⋮ или «Установить приложение»), либо пункт «Установить приложение» в подвале сайта.'}
        </p>

        <ul className="pwa-prompt__perks">
          <li>Быстрый вход с иконки</li>
          <li>Удобнее на телефоне</li>
          <li>Работает офлайн после визита</li>
        </ul>

        <div className="pwa-prompt__actions">
          {pwa.canPrompt ? (
            <button type="button" className="pwa-prompt__install" onClick={install}>
              Установить приложение
            </button>
          ) : pwa.iosHint ? (
            <button type="button" className="pwa-prompt__install" onClick={snooze}>
              Понятно
            </button>
          ) : (
            <button type="button" className="pwa-prompt__install" onClick={snooze}>
              Хорошо
            </button>
          )}
          <button type="button" className="pwa-prompt__later" onClick={snooze}>
            Позже
          </button>
        </div>
      </div>
    </section>
  );
}

