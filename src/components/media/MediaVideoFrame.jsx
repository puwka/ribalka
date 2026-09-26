import { isDirectVideoUrl } from '../../lib/mediaCover';
import { toVideoEmbedUrl } from '../../lib/videoEmbed';

/** Detail-page media: uploaded file → <video>, YouTube/VK → <iframe>. */
export default function MediaVideoFrame({ src, title = 'Видео', className = '' }) {
  const raw = String(src || '').trim();
  if (!raw) return null;

  if (isDirectVideoUrl(raw)) {
    return (
      <video
        className={className}
        src={raw}
        controls
        playsInline
        preload="metadata"
        title={title}
        style={{ width: '100%', borderRadius: 12, background: '#0f172a' }}
      />
    );
  }

  const embed = toVideoEmbedUrl(raw);

  return (
    <iframe
      className={className}
      src={embed}
      title={title}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
