/** Lightweight HTML helpers for description fields. */

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'UL',
  'OL',
  'LI',
  'DIV',
  'SPAN',
  'H2',
  'H3',
  'A',
]);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ''));
}

/** Convert plain text (with newlines / legacy **bold**) into simple HTML. */
export function plainTextToHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '<p><br></p>';
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return `<p>${lines || '<br>'}</p>`;
    })
    .join('');
}

export function toEditorHtml(value) {
  if (!value || !String(value).trim()) return '<p><br></p>';
  if (looksLikeHtml(value)) return sanitizeRichHtml(value) || '<p><br></p>';
  return plainTextToHtml(value);
}

/**
 * Strip unsafe tags/attrs. Keeps basic formatting for descriptions.
 */
export function sanitizeRichHtml(html) {
  if (!html || typeof html !== 'string') return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+=(["'])[\s\S]*?\1/gi, '')
      .replace(/javascript:/gi, '');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === 1) {
        const tag = child.tagName;
        if (!ALLOWED_TAGS.has(tag)) {
          const parent = child.parentNode;
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
          continue;
        }

        if (tag === 'A') {
          const href = String(child.getAttribute('href') || '').trim();
          [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
          if (/^https?:\/\//i.test(href)) {
            child.setAttribute('href', href);
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          } else {
            const parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
            continue;
          }
        } else {
          [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
        }
        walk(child);
      } else if (child.nodeType === 8) {
        child.remove();
      }
    }
  };
  walk(doc.body);

  let out = doc.body.innerHTML
    .replace(/<div>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim();

  if (!out || out === '<br>' || out === '<p><br></p>') return '';
  return out;
}

/** Empty or whitespace-only editor markup → empty string for storage. */
export function normalizeRichHtml(html) {
  const cleaned = sanitizeRichHtml(html);
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? cleaned : '';
}

/** Plain preview text from HTML or markdown-ish content. */
export function stripRichText(value, maxLen = 280) {
  let text = String(value || '');
  if (looksLikeHtml(text)) {
    text = text
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLen > 0 && text.length > maxLen) return `${text.slice(0, maxLen).trim()}…`;
  return text;
}
