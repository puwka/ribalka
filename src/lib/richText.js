/** Lightweight HTML helpers for description fields. */

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'DIV', 'SPAN']);

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

/** Convert plain text (with newlines) into simple HTML for the editor. */
export function plainTextToHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '<p><br></p>';
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).replace(/\n/g, '<br>');
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
        [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
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
