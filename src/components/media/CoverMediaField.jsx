import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { uploadService } from '../../services/uploadService';
import { SHORT_VIDEO_MAX_SEC } from '../../lib/mediaCover';
import { isDirectVideoUrl } from '../../lib/mediaCover';
import './ImageUpload.css';
import './CoverMediaField.css';

/**
 * Single cover slot: either a photo or a short muted autoplay video for cards.
 * onChange({ url, kind }) where kind is 'image' | 'video' | ''.
 */
export default function CoverMediaField({
  label = 'Обложка карточки',
  value = '',
  kind = '',
  onChange,
  imageBucket = uploadService.buckets.site,
  videoBucket = uploadService.buckets.siteVideo,
  disabled = false,
  hint,
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(kind === 'video' || isDirectVideoUrl(value) ? 'video' : 'image');

  const resolvedKind = kind || (isDirectVideoUrl(value) ? 'video' : value ? 'image' : '');

  const emit = (url, nextKind) => {
    onChange?.({ url: url || '', kind: url ? nextKind : '' });
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      if (mode === 'video') {
        const url = await uploadService.uploadShortVideo(file, {
          userId: user?.id,
          bucket: videoBucket,
        });
        emit(url, 'video');
      } else {
        const url = await uploadService.uploadImage(file, {
          userId: user?.id,
          bucket: imageBucket,
        });
        emit(url, 'image');
      }
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cover-media-field">
      <div className="cover-media-field__head">
        <span className="cover-media-field__label">{label}</span>
        <div className="cover-media-field__modes" role="group" aria-label="Тип обложки">
          <button
            type="button"
            className={mode === 'image' ? 'is-active' : ''}
            disabled={disabled || uploading}
            onClick={() => {
              setMode('image');
              if (resolvedKind === 'video') emit('', '');
            }}
          >
            Фото
          </button>
          <button
            type="button"
            className={mode === 'video' ? 'is-active' : ''}
            disabled={disabled || uploading}
            onClick={() => {
              setMode('video');
              if (resolvedKind === 'image') emit('', '');
            }}
          >
            Видео {SHORT_VIDEO_MAX_SEC} сек
          </button>
        </div>
      </div>
      <p className="cover-media-field__hint">
        {hint ||
          (mode === 'video'
            ? `Короткий ролик до ${SHORT_VIDEO_MAX_SEC} сек (MP4/WebM) — на карточке запустится сам, без кнопок и звука`
            : 'JPG, PNG, WebP · до 8 МБ — обложка в списке карточек')}
      </p>

      <div className="image-upload">
        {value ? (
          <div className="image-upload__preview-wrap cover-media-field__preview">
            {resolvedKind === 'video' || isDirectVideoUrl(value) ? (
              <video src={value} muted loop playsInline autoPlay className="image-upload__preview" />
            ) : (
              <img src={value} alt="" className="image-upload__preview" />
            )}
          </div>
        ) : (
          <div className="image-upload__placeholder">
            {mode === 'video' ? 'Видео не выбрано' : 'Фото не выбрано'}
          </div>
        )}
        <div className="image-upload__actions">
          <label className={`image-upload__btn${disabled || uploading ? ' is-disabled' : ''}`}>
            {uploading ? 'Загрузка…' : value ? 'Заменить' : mode === 'video' ? 'Выбрать видео' : 'Выбрать фото'}
            <input
              type="file"
              accept={mode === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'}
              hidden
              disabled={disabled || uploading}
              onChange={onFile}
            />
          </label>
          {value && !disabled && (
            <button type="button" className="image-upload__remove" onClick={() => emit('', '')}>
              Удалить
            </button>
          )}
        </div>
        {error && <div className="image-upload__error">{error}</div>}
      </div>
    </div>
  );
}
