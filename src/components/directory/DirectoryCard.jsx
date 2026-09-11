/** Shared directory listing card */

import { useEffect, useRef } from 'react';
import { api, apiDataEnabled } from '../../lib/apiClient';

export function getCategoryLabel(category) {
  const labels = {
    shop: '🛒 Магазин',
    service: '🔧 Сервис',
    guide: '👨‍🏫 Гид / егерь',
  };
  return labels[category] || '';
}

function sessionKey() {
  try {
    const k = 'dir_analytics_sid';
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID?.() || `s-${Date.now()}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return null;
  }
}

async function trackDirectoryEvent(itemId, eventType) {
  if (!apiDataEnabled || !itemId) return;
  try {
    await api.post('/api/directory/events', {
      itemId,
      eventType,
      sessionKey: sessionKey(),
    });
  } catch {
    /* non-blocking */
  }
}

function hasWebsite(item) {
  return Boolean(String(item?.website || '').trim());
}

export default function DirectoryCard({ item }) {
  const viewed = useRef(false);
  const classes = [
    'directory-card',
    item.yellowFrame || item.highlight ? 'directory-card--frame' : '',
    item.isTop || item.top ? 'directory-card--top' : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (viewed.current || !item?.id) return;
    viewed.current = true;
    void trackDirectoryEvent(item.id, 'view');
  }, [item?.id]);

  const onPhone = () => {
    void trackDirectoryEvent(item.id, 'phone');
  };

  const onWebsite = () => {
    void trackDirectoryEvent(item.id, 'website');
  };

  const website = hasWebsite(item) ? String(item.website).trim() : '';

  return (
    <div className={classes}>
      <div className="card-image">
        {item.image ? <img src={item.image} alt={item.name} /> : null}
        <div className="card-category">{getCategoryLabel(item.category)}</div>
        {(item.isTop || item.top) && <div className="card-badge-top">ТОП</div>}
      </div>

      <div className="card-body">
        <h3 className="card-title">{item.name}</h3>
        <p className="card-description">{item.description}</p>

        <div className="card-tags">
          {(item.tags || []).map((tag, i) => (
            <span key={`${tag}-${i}`} className="tag">
              {tag}
            </span>
          ))}
        </div>

        <div className="card-info">
          {item.address && (
            <div className="info-row">
              <span className="info-icon">📍</span>
              <span>{item.address}</span>
            </div>
          )}
          {item.phone && (
            <div className="info-row">
              <span className="info-icon">📞</span>
              <a href={`tel:${item.phone}`} className="info-link" onClick={onPhone}>
                {item.phone}
              </a>
            </div>
          )}
          {item.hours && (
            <div className="info-row">
              <span className="info-icon">🕐</span>
              <span>{item.hours}</span>
            </div>
          )}
          {website ? (
            <div className="info-row">
              <span className="info-icon">🌐</span>
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="info-link"
                onClick={onWebsite}
              >
                Перейти на сайт
              </a>
            </div>
          ) : null}
        </div>

        <div className="card-actions">
          {item.phone && (
            <a href={`tel:${item.phone}`} className="btn btn-primary" onClick={onPhone}>
              📞 Позвонить
            </a>
          )}
          {website ? (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              onClick={onWebsite}
            >
              🌐 Сайт
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
