import { useEffect, useRef } from 'react';
import { isDirectVideoUrl } from '../../lib/mediaCover';
import './CardCoverMedia.css';

/**
 * Card cover: photo or short video autoplaying muted (no controls / play overlay).
 */
export default function CardCoverMedia({
  imageUrl = '',
  videoUrl = '',
  alt = '',
  className = '',
}) {
  const videoRef = useRef(null);
  const playVideo = isDirectVideoUrl(videoUrl) ? videoUrl : '';
  const showImage = !playVideo && Boolean(imageUrl);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !playVideo) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    tryPlay();
    el.addEventListener('loadeddata', tryPlay);
    return () => el.removeEventListener('loadeddata', tryPlay);
  }, [playVideo]);

  if (!playVideo && !showImage) {
    return <div className={`card-cover-media card-cover-media--empty ${className}`.trim()} aria-hidden />;
  }

  return (
    <div className={`card-cover-media ${className}`.trim()}>
      {playVideo ? (
        <video
          ref={videoRef}
          className="card-cover-media__video"
          src={playVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          tabIndex={-1}
          aria-hidden
        />
      ) : (
        <img className="card-cover-media__img" src={imageUrl} alt={alt} loading="lazy" />
      )}
    </div>
  );
}
