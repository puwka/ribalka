import { useEffect } from 'react';
import './ImageLightbox.css';

/**
 * Fullscreen photo viewer with optional prev/next.
 * @param {string[]} images
 * @param {number|null} index — null/undefined closes
 * @param {(next: number|null) => void} onClose — pass null to close; or use onChange for nav
 * @param {(next: number) => void} [onIndexChange]
 * @param {string} [alt]
 */
export default function ImageLightbox({
  images = [],
  index = null,
  onClose,
  onIndexChange,
  alt = '',
}) {
  const open = index != null && index >= 0 && images.length > 0;
  const current = open ? images[index] : null;
  const multi = images.length > 1;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (!multi || !onIndexChange) return;
      if (e.key === 'ArrowLeft') {
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight') {
        onIndexChange((index + 1) % images.length);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, index, images.length, multi, onClose, onIndexChange]);

  if (!open || !current) return null;

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={() => onClose?.()}
    >
      <button
        type="button"
        className="image-lightbox__close"
        aria-label="Закрыть"
        onClick={() => onClose?.()}
      >
        ✕
      </button>

      {multi ? (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--prev"
          aria-label="Предыдущее фото"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange?.((index - 1 + images.length) % images.length);
          }}
        >
          ‹
        </button>
      ) : null}

      <img
        src={current}
        alt={alt}
        className="image-lightbox__img"
        onClick={(e) => e.stopPropagation()}
      />

      {multi ? (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--next"
          aria-label="Следующее фото"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange?.((index + 1) % images.length);
          }}
        >
          ›
        </button>
      ) : null}

      {multi ? (
        <div className="image-lightbox__counter" onClick={(e) => e.stopPropagation()}>
          {index + 1} / {images.length}
        </div>
      ) : null}
    </div>
  );
}
