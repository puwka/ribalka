/**
 * Convert common video watch URLs to embeddable iframe src.
 */
export function toVideoEmbedUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';

  try {
    const u = new URL(url);

    // Already embed
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
      return url;
    }

    // youtube.com/watch?v=
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    }

    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // VK: leave as-is if already video_ext, else keep original
    if (u.hostname.includes('vk.com') || u.hostname.includes('vkvideo.ru')) {
      return url;
    }
  } catch {
    /* not a URL — return as-is if looks like embed path */
  }

  return url;
}

export function normalizeVideoList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => (typeof v === 'string' ? v : v?.external_url || v?.public_url || v?.url || ''))
    .map(toVideoEmbedUrl)
    .filter(Boolean);
}
