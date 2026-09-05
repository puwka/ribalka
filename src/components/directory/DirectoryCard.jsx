/** Shared directory listing card */

export function getCategoryLabel(category) {
  const labels = {
    shop: '🛒 Магазин',
    service: '🔧 Сервис',
    guide: '👨‍🏫 Гид',
  };
  return labels[category] || '';
}

export default function DirectoryCard({ item }) {
  const classes = [
    'directory-card',
    item.yellowFrame || item.highlight ? 'directory-card--frame' : '',
    item.isTop || item.top ? 'directory-card--top' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
              <a href={`tel:${item.phone}`} className="info-link">
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
          {item.website && (
            <div className="info-row">
              <span className="info-icon">🌐</span>
              <a href={item.website} target="_blank" rel="noopener noreferrer" className="info-link">
                Перейти на сайт
              </a>
            </div>
          )}
        </div>

        <div className="card-actions">
          {item.phone && (
            <a href={`tel:${item.phone}`} className="btn btn-primary">
              📞 Позвонить
            </a>
          )}
          {item.website && (
            <a
              href={item.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              🌐 Сайт
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
