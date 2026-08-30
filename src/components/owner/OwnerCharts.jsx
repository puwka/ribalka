import './OwnerCharts.css';

function maxValue(points) {
  return Math.max(1, ...points.map((p) => p.value));
}

export function LineChart({ title, points, color = '#2563eb' }) {
  const width = 560;
  const height = 180;
  const pad = 28;
  const max = maxValue(points);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (p.value / max) * (height - pad * 2);
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const area =
    coords.length > 0
      ? `${path} L ${coords[coords.length - 1].x} ${height - pad} L ${coords[0].x} ${height - pad} Z`
      : '';

  return (
    <div className="owner-chart">
      <div className="owner-chart__title">{title}</div>
      {points.every((p) => p.value === 0) ? (
        <div className="owner-chart__empty">Нет данных за период</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="owner-chart__svg" role="img">
          <path d={area} fill={color} opacity="0.12" />
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
          {coords.map((c) => (
            <circle key={c.date} cx={c.x} cy={c.y} r="3" fill={color} />
          ))}
        </svg>
      )}
      <div className="owner-chart__legend">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function BarChart({ title, points, color = '#0f766e' }) {
  const max = maxValue(points);
  const visible = points.length > 14
    ? points.filter((_, i) => i % Math.ceil(points.length / 14) === 0)
    : points;

  return (
    <div className="owner-chart">
      <div className="owner-chart__title">{title}</div>
      {points.every((p) => p.value === 0) ? (
        <div className="owner-chart__empty">Нет данных за период</div>
      ) : (
        <div className="owner-bars">
          {visible.map((p) => (
            <div key={p.date} className="owner-bars__item" title={`${p.date}: ${p.value}`}>
              <div
                className="owner-bars__fill"
                style={{ height: `${(p.value / max) * 100}%`, background: color }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PeriodFilters({ value, onChange, periods }) {
  return (
    <div className="period-filters">
      {periods.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`period-filters__btn${value === p.id ? ' is-active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
