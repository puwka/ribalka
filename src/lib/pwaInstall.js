/**
 * Captures beforeinstallprompt as early as possible (before lazy UI mounts).
 * Chrome fires BIP once — if we miss it, Install stays broken until next visit.
 */

let deferred = null;
let pendingOpen = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(getState());
    } catch {
      /* ignore */
    }
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIosSafari() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function getState() {
  return {
    canPrompt: Boolean(deferred) && !isStandalone(),
    iosHint: isIosSafari() && !isStandalone(),
    installed: isStandalone(),
  };
}

export function subscribePwaInstall(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

export function captureInstallPrompt(event) {
  if (!event) return;
  event.preventDefault();
  deferred = event;
  emit();
}

/** Native install dialog when available. Returns outcome or null. */
export async function promptPwaInstall() {
  if (!deferred || isStandalone()) return null;
  const event = deferred;
  deferred = null;
  emit();
  try {
    event.prompt();
    const choice = await event.userChoice;
    if (choice?.outcome !== 'accepted') {
      // Browser may re-fire BIP later; keep listening
    }
    return choice?.outcome || null;
  } catch {
    return null;
  }
}

/** Call once from main.jsx before React mounts heavy UI. */
export function initPwaInstallCapture() {
  if (typeof window === 'undefined') return;
  // Drop legacy 90-day hide so install stays reachable after update
  try {
    localStorage.removeItem('pwa_install_dismissed_until');
    localStorage.removeItem('pwa_install_last_shown');
  } catch {
    /* ignore */
  }
  window.addEventListener('beforeinstallprompt', captureInstallPrompt);
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

/** Open install sheet from menu / footer (listened by PwaInstallPrompt). */
export function openPwaInstallPrompt() {
  if (typeof window === 'undefined' || isStandalone()) return;
  pendingOpen = true;
  window.dispatchEvent(new CustomEvent('pwa-open-install'));
}

export function consumePendingOpen() {
  if (!pendingOpen) return false;
  pendingOpen = false;
  return true;
}
