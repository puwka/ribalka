/** Card cover helpers: photo or short uploaded video (not YouTube embeds). */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i;
const VIDEO_MIME = /^(video\/(mp4|webm|quicktime))$/i;

export const SHORT_VIDEO_MAX_SEC = 15;
export const SHORT_VIDEO_MAX_BYTES = 20 * 1024 * 1024;

export function isDirectVideoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  if (VIDEO_EXT.test(url)) return true;
  // Uploaded files served as /uploads/{bucket}/…/uuid.mp4
  if (/\/uploads\/[^?\s]+\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url)) return true;
  return false;
}

export function isEmbedVideoUrl(value) {
  const url = String(value || '').trim().toLowerCase();
  if (!url) return false;
  return (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vk.com') ||
    url.includes('vkvideo.ru')
  );
}

/** First uploaded (non-embed) video URL from a list. */
export function firstDirectVideo(videos = []) {
  for (const v of videos || []) {
    const url = typeof v === 'string' ? v : v?.external_url || v?.public_url || v?.url || '';
    if (isDirectVideoUrl(url) && !isEmbedVideoUrl(url)) return url;
  }
  return '';
}

/**
 * Pick cover for catalog cards: prefer short uploaded video, else first image.
 * @returns {{ imageUrl: string, videoUrl: string }}
 */
export function pickCardCover({ images = [], videos = [], image = '', coverVideo = '' } = {}) {
  const videoUrl =
    (isDirectVideoUrl(coverVideo) && !isEmbedVideoUrl(coverVideo) ? coverVideo : '') ||
    firstDirectVideo(videos);
  if (videoUrl) return { imageUrl: '', videoUrl };
  const imageUrl = (Array.isArray(images) ? images.find(Boolean) : '') || image || '';
  return { imageUrl, videoUrl: '' };
}

export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const duration = Number(el.duration) || 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать видео'));
    };
    el.src = url;
  });
}

export async function assertShortVideoFile(file, { maxSec = SHORT_VIDEO_MAX_SEC, maxBytes = SHORT_VIDEO_MAX_BYTES } = {}) {
  if (!file) throw new Error('Файл не выбран');
  if (!VIDEO_MIME.test(file.type || '') && !VIDEO_EXT.test(file.name || '')) {
    throw new Error('Допустимы MP4 или WebM');
  }
  if (file.size > maxBytes) {
    throw new Error(`Видео слишком большое (макс. ${Math.round(maxBytes / (1024 * 1024))} МБ)`);
  }
  const duration = await readVideoDuration(file);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Не удалось определить длительность видео');
  }
  if (duration > maxSec + 0.35) {
    throw new Error(`Видео длиннее ${maxSec} секунд — обрежьте ролик`);
  }
  return duration;
}
