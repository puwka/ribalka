import { cmsDb } from '../lib/cmsDb';
import { mediaService } from './mediaService';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1_500_000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

async function compressImage(file, { maxWidth = 1920, quality = 0.85 } = {}) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('Допустимы только изображения (JPG, PNG, WebP)');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Файл слишком большой (макс. 8 МБ)');
  }

  const img = await loadImage(file);
  let width = img.width;
  let height = img.height;

  if (width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let q = quality;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
  while (blob && blob.size > MAX_OUTPUT_BYTES && q > 0.45) {
    q -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
  }
  if (!blob) throw new Error('Не удалось обработать изображение');

  const baseName = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveToMediaLibrary(file, url, userId) {
  await cmsDb.putMedia({
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type,
    size: file.size,
    url,
    created_at: new Date().toISOString(),
    uploaded_by: userId || null,
  });
}

export const uploadService = {
  buckets: {
    news: 'news-images',
    base: 'base-images',
    site: 'advertising',
    avatar: 'avatars',
    report: 'report-images',
  },

  async uploadImage(file, { userId, bucket = 'news-images' } = {}) {
    const prepared = await compressImage(file);

    if (mediaService.isEnabled()) {
      try {
        const { publicUrl } = await mediaService.upload(bucket, prepared, userId);
        if (publicUrl) {
          await saveToMediaLibrary(prepared, publicUrl, userId);
          return publicUrl;
        }
      } catch {
        /* fallback to local storage */
      }
    }

    const dataUrl = await fileToDataUrl(prepared);
    await saveToMediaLibrary(prepared, dataUrl, userId);
    return dataUrl;
  },

  async uploadImages(files, options = {}) {
    const list = Array.from(files || []);
    const urls = [];
    for (const file of list) {
      urls.push(await this.uploadImage(file, options));
    }
    return urls;
  },
};
