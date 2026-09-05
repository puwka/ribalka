import { useEffect, useState } from 'react';
import './PwaInstallPrompt.css';

const DISMISS_KEY = 'pwa_install_dismissed_until';
const LAST_SHOWN_KEY = 'pwa_install_last_shown';
const DISMISS_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const RESHOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const SHOW_DELAY_MS = 15000; // 15 seconds

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
  } catch {}
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
export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isStandalone() || !shouldOffer()) return;

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
      setAnimate(true);
      setTimeout(() => setVisible(true), 10);
    };

    const onBip = e => {
      e.preventDefault();
      setDeferred(e);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    timer = window.setTimeout(reveal, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

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
    <section
      className={`pwa-prompt ${animate ? 'pwa-prompt--slide-in' : ''}`}
      role="dialog"
      aria-label="Установка приложения"
    >
      <div className="pwa-prompt__card">
        <button className="pwa-prompt__close" aria-label="Закрыть" onClick={dismiss}>
          &times;
        </button>
        <div className="pwa-prompt__content">
          <strong className="pwa-prompt__title">Установить приложение</strong>
          <p className="pwa-prompt__desc">
            {iosHint
              ? 'На iPhone: «Поделиться» → «На экран «Домой»»'
              : 'Быстрый доступ с домашнего экрана и работа офлайн'}
          </p>
        </div>
        <div className="pwa-prompt__actions">
          {deferred && (
            <button className="pwa-prompt__install" onClick={install}>
              Установить
            </button>
          )}
          <button className="pwa-prompt__later" onClick={dismiss}>
            Позже
          </button>
        </div>
      </div>
    </section>
  );
}
