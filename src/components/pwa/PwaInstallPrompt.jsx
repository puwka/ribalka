import { useEffect, useState } from 'react';
import './PwaInstallPrompt.css';

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa_install_dismissed') === '1';
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone || dismissed) return undefined;

    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem('pwa_install_dismissed', '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="pwa-prompt" role="dialog" aria-label="Установка приложения">
      <div className="pwa-prompt__inner">
        <div>
          <strong>Установить приложение</strong>
          <p>
            {iosHint
              ? 'На iPhone: «Поделиться» → «На экран «Домой»»'
              : 'Быстрый доступ с домашнего экрана и работа офлайн'}
          </p>
        </div>
        <div className="pwa-prompt__actions">
          {deferred && (
            <button type="button" className="pwa-prompt__install" onClick={install}>
              Установить
            </button>
          )}
          <button type="button" className="pwa-prompt__later" onClick={dismiss}>
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
