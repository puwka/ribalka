/** Shared directory listing card */

import { useEffect, useRef } from 'react';
import { api, apiDataEnabled } from '../../lib/apiClient';
import { getItemRegion, isDirectoryTopActive } from '../../lib/directoryRegion';

export function getCategoryLabel(category) {
  const labels = {
    shop: '🛒 Магазин',
    service: '🔧 Сервис',
    guide: '👨‍🏫 Гид / егерь',
  };
  return labels[category] || '';
}

const DAY_TOKEN =
  '(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс|Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)';

/** Split jammed one-line schedules into readable lines. */
export function formatHoursLines(hours) {
  const raw = String(hours || '').trim();
  if (!raw) return [];
  if (/\n/.test(raw)) {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const withBreaks = raw
    .replace(/\s*[;|]\s*/g, '\n')
    // Break before a new day only after a time or «выходной» (keeps «Вт – Ср»)
    .replace(
      new RegExp(`((?:\\d{1,2}:\\d{2}|выходн[а-яёА-ЯЁ]*))\\s+(${DAY_TOKEN})`, 'gi'),
      '$1\n$2'
    );
  return withBreaks
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  const region = getItemRegion(item);
  const isTop = isDirectoryTopActive(item);
  const classes = [
    'directory-card',
    item.yellowFrame || item.highlight ? 'directory-card--frame' : '',
    isTop ? 'directory-card--top' : '',
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
  const hoursLines = formatHoursLines(item.hours);

  return (
    <div className={classes}>
      <div className="card-image">
        {item.image ? <img src={item.image} alt={item.name} /> : null}
        {isTop && <div className="card-badge-top">ТОП</div>}
      </div>

      <div className="card-body">
        <h3 className="card-title">{item.name}</h3>
        {region ? <p className="card-region-line">{region}</p> : null}
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
          {hoursLines.length > 0 && (
            <div className="info-row">
              <span className="info-icon">🕐</span>
              <span className="info-hours">
                {hoursLines.map((line, i) => (
                  <span key={`${i}-${line}`} className="info-hours__line">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          )}
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
