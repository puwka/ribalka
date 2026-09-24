import { useEffect, useRef } from 'react';

const AGENT_ID = '61d8fa49-343e-4c5a-b81d-5a03876d0f57';
const WIDGET_SCRIPT_SRC =
  'https://s3.twcstorage.ru/8f3135d2-f31a39da-bf84-440b-b768-c0589e415f20/agent-chat-widget.js';
const WIDGET_SCRIPT_ID = 'timeweb-agent-chat-widget-js';
const WS_URL = 'https://chat.timeweb.cloud';

/** Inline layout overrides inside Timeweb shadow root */
const INLINE_SHADOW_CSS = `
.agent-chat-widget,
.agent-chat-widget.is-open {
  all: initial;
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  bottom: auto !important;
  right: auto !important;
  left: auto !important;
  top: auto !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  box-shadow: none !important;
  font-size: 14px;
  font-family: var(--widget-font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  z-index: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  -webkit-font-smoothing: antialiased;
}
.floating-button-container,
.floating-button {
  display: none !important;
}
.resize-handle,
.resizer {
  display: none !important;
}
.chat-container {
  width: 100% !important;
  height: 100% !important;
  flex: 1 1 auto !important;
}
`;

function loadWidgetScript() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (customElements.get('agent-chat-widget')) return Promise.resolve();
  const existing = document.getElementById(WIDGET_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (customElements.get('agent-chat-widget')) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить чат Егорыча')), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить чат Егорыча'));
    document.head.appendChild(script);
  });
}

function applyInlineStyles(widget) {
  const root = widget.shadowRoot;
  if (!root) return false;
  if (root.getElementById('egorych-inline-style')) return true;
  const style = document.createElement('style');
  style.id = 'egorych-inline-style';
  style.textContent = INLINE_SHADOW_CSS;
  root.appendChild(style);
  return true;
}

/**
 * Timeweb Cloud AI agent «Егорыч» — inline chat on the page (not a corner bubble).
 * @see https://timeweb.cloud/docs/ai-agents/manage-agents/embed-chatbots
 */
export default function TimewebAgentEmbed({
  className = '',
  open = true,
  showButton = false,
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let widget = null;
    let observer = null;
    let tries = 0;
    let tryTimer = null;

    const mount = async () => {
      try {
        await loadWidgetScript();
        if (cancelled || !hostRef.current) return;

        // Remove leftover floating widgets from body (previous embed.js loads)
        document.querySelectorAll('agent-chat-widget').forEach((el) => {
          if (!host.contains(el)) el.remove();
        });

        widget = document.createElement('agent-chat-widget');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const attrs = {
          'data-agent-access-id': AGENT_ID,
          'data-wsurl': WS_URL,
          'data-open': open ? 'true' : 'false',
          'data-show-button': showButton ? 'true' : 'false',
          'data-name': 'Егорыч',
          'data-signature': 'Помощник сайта',
          'data-welcome-message':
            'Привет! Я Егорыч. Спроси, куда съездить на рыбалку, где купить червей или на что ловить — подскажу места и магазины с нашего сайта.',
          'data-primary-color': '#3d5a36',
          'data-background-color': '#F2F2F2',
          'data-header-footer-color': '#1a2418',
          'data-text-color': '#ffffff',
          'data-chat-position': 'bottom_right',
          'data-icon-url': `${origin}/img/egorych.png`,
          'data-avatar-link': `${origin}/img/egorych.png`,
          'data-show-tool-processing': 'false',
          'data-show-confirmation-buttons': 'true',
        };
        Object.entries(attrs).forEach(([k, v]) => widget.setAttribute(k, v));
        host.appendChild(widget);

        const ensureInline = () => {
          if (cancelled || !widget) return;
          if (applyInlineStyles(widget)) {
            try {
              if (open && typeof widget.show === 'function') widget.show();
            } catch {
              /* ignore */
            }
            if (typeof window !== 'undefined' && typeof window.twc_agent_open === 'function') {
              try {
                window.twc_agent_open();
              } catch {
                /* ignore */
              }
            }
            return;
          }
          tries += 1;
          if (tries < 40) {
            tryTimer = window.setTimeout(ensureInline, 100);
          }
        };

        observer = new MutationObserver(() => {
          if (widget?.shadowRoot) ensureInline();
        });
        observer.observe(widget, { childList: true, subtree: true });
        ensureInline();
      } catch (err) {
        if (!cancelled && hostRef.current) {
          hostRef.current.innerHTML = `<p class="egorych-chat__error">${
            err?.message || 'Чат временно недоступен'
          }</p>`;
        }
      }
    };

    mount();

    return () => {
      cancelled = true;
      if (tryTimer) window.clearTimeout(tryTimer);
      observer?.disconnect();
      if (widget?.parentNode) widget.parentNode.removeChild(widget);
      document.querySelectorAll('agent-chat-widget').forEach((el) => el.remove());
    };
  }, [open, showButton]);

  return (
    <div
      ref={hostRef}
      className={`egorych-chat-host ${className}`.trim()}
      aria-label="Чат с Егорычем"
    />
  );
}
