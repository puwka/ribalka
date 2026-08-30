import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { uploadService } from '../../services/uploadService';
import { AdminField } from '../admin/AdminUI';
import './ImageUpload.css';

export function ImageUploadField({
  label,
  value = '',
  onChange,
  bucket = uploadService.buckets.site,
  disabled = false,
  hint,
  className = '',
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const url = await uploadService.uploadImage(file, {
        userId: user?.id,
        bucket,
      });
      onChange(url);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminField label={label} hint={hint || 'JPG, PNG, WebP · до 8 МБ'} className={className}>
      <div className="image-upload">
        {value ? (
          <div className="image-upload__preview-wrap">
            <img src={value} alt="" className="image-upload__preview" />
          </div>
        ) : (
          <div className="image-upload__placeholder">Файл не выбран</div>
        )}
        <div className="image-upload__actions">
          <label className={`image-upload__btn${disabled || uploading ? ' is-disabled' : ''}`}>
            {uploading ? 'Загрузка…' : value ? 'Заменить файл' : 'Выбрать файл'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              disabled={disabled || uploading}
              onChange={onFile}
            />
          </label>
          {value && !disabled && (
            <button type="button" className="image-upload__remove" onClick={() => onChange('')}>
              Удалить
            </button>
          )}
        </div>
        {error && <div className="image-upload__error">{error}</div>}
      </div>
    </AdminField>
  );
}

export function ImageUploadListField({
  label,
  value = '',
  onChange,
  bucket = uploadService.buckets.base,
  disabled = false,
  max = 20,
  hint,
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const urls = String(value || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const update = (next) => onChange(next.join('\n'));

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (urls.length + files.length > max) {
      setError(`Максимум ${max} фото`);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadService.uploadImages(files, {
        userId: user?.id,
        bucket,
      });
      update([...urls, ...uploaded]);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (index) => {
    update(urls.filter((_, i) => i !== index));
  };

  return (
    <AdminField label={label} hint={hint || `До ${max} фото · JPG, PNG, WebP`}>
      <div className="image-upload-list">
        {urls.length > 0 && (
          <div className="image-upload-list__grid">
            {urls.map((url, index) => (
              <div key={`${url}-${index}`} className="image-upload-list__item">
                <img src={url} alt="" />
                {!disabled && (
                  <button
                    type="button"
                    className="image-upload-list__remove"
                    aria-label="Удалить"
                    onClick={() => removeAt(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!disabled && urls.length < max && (
          <label className={`image-upload__btn${uploading ? ' is-disabled' : ''}`}>
            {uploading ? 'Загрузка…' : 'Добавить фото'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              disabled={uploading}
              onChange={onFiles}
            />
          </label>
        )}
        {error && <div className="image-upload__error">{error}</div>}
      </div>
    </AdminField>
  );
}

/** Compact variant for non-admin forms (owner cabinet) */
export function ImageUploadListCompact({
  label,
  value = '',
  onChange,
  bucket = uploadService.buckets.base,
  disabled = false,
  max = 20,
}) {
  return (
    <div className="base-form__full">
      <ImageUploadListField
        label={label}
        value={value}
        onChange={onChange}
        bucket={bucket}
        disabled={disabled}
        max={max}
      />
    </div>
  );
}
