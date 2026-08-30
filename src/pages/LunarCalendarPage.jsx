import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { lunarCalendarService } from '../services/lunarCalendarService';
import './LunarCalendarPage.css';

export default function LunarCalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = useMemo(
    () => lunarCalendarService.buildMonthDays(year, month),
    [year, month]
  );
  const info = useMemo(() => lunarCalendarService.getDayLunarInfo(selected), [selected]);
  const selectedKey = lunarCalendarService.toDateKey(selected);

  const prev = () => setCursor(new Date(year, month - 1, 1));
  const next = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(now);
  };

  return (
    <div className="lunar-page">
      <div className="lunar-page__hero">
        <div className="lunar-page__hero-inner">
          <p className="lunar-page__eyebrow">Лунный календарь рыболова</p>
          <h1>Фазы луны и прогноз клёва</h1>
          <p className="lunar-page__lead">
            Выберите день — увидите фазу, активность, лучшее время суток и рекомендации.
          </p>
          <div className="lunar-page__hero-actions">
            <button type="button" className="lunar-btn" onClick={goToday}>Сегодня</button>
            <Link to="/calendar" className="lunar-btn lunar-btn--ghost">Запреты и сезоны</Link>
          </div>
        </div>
      </div>

      <div className="lunar-page__layout">
        <section className="lunar-card lunar-card--calendar">
          <div className="lunar-cal-nav">
            <button type="button" onClick={prev} aria-label="Предыдущий месяц">‹</button>
            <h2>
              {lunarCalendarService.monthNames[month]} {year}
            </h2>
            <button type="button" onClick={next} aria-label="Следующий месяц">›</button>
          </div>

          <div className="lunar-weekdays">
            {lunarCalendarService.dayNames.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="lunar-grid">
            {days.map((day) => {
              const key = day.dateKey;
              const isSelected = key === selectedKey;
              const isToday = key === lunarCalendarService.toDateKey(today);
              return (
                <button
                  key={`${key}-${day.inMonth}`}
                  type="button"
                  className={[
                    'lunar-day',
                    day.inMonth ? '' : 'is-out',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    `is-${day.forecast.level}`,
                  ].join(' ')}
                  onClick={() => setSelected(day.date)}
                >
                  <span className="lunar-day__num">{day.date.getDate()}</span>
                  <span className="lunar-day__emoji">{day.moon.emoji}</span>
                  <span className="lunar-day__score">{day.forecast.score}</span>
                </button>
              );
            })}
          </div>

          <div className="lunar-legend">
            <span><i className="dot excellent" /> Отличный</span>
            <span><i className="dot good" /> Хороший</span>
            <span><i className="dot average" /> Средний</span>
            <span><i className="dot poor" /> Слабый</span>
          </div>
        </section>

        <aside className="lunar-side">
          <div className="lunar-card lunar-moon">
            <div className="lunar-moon__emoji">{info.moon.emoji}</div>
            <div>
              <h3>{info.moon.name}</h3>
              <p>
                {selected.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <p className="lunar-moon__meta">
                Освещённость {info.moon.illumination}% · возраст {info.moon.age} дн.
              </p>
            </div>
          </div>

          <div className="lunar-card">
            <h3>Прогноз клёва</h3>
            <div className={`lunar-score lunar-score--${info.forecast.level}`}>
              <strong>{info.forecast.score}</strong>
              <span>{info.forecast.label}</span>
            </div>
            <div className="lunar-meter">
              <div style={{ width: `${info.activity.value}%` }} />
            </div>
            <p className="lunar-muted">Активность: {info.activity.label} ({info.activity.value}%)</p>
          </div>

          <div className="lunar-card">
            <h3>Лучшее время суток</h3>
            <ul className="lunar-times">
              {info.bestTimes.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.label}</strong>
                    <span>{t.range}</span>
                  </div>
                  <em>{t.score}</em>
                </li>
              ))}
            </ul>
          </div>

          <div className="lunar-card">
            <h3>Рекомендации</h3>
            <ul className="lunar-tips">
              {info.recommendations.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <label className="lunar-card lunar-date-pick">
            Выбор даты
            <input
              type="date"
              value={selectedKey}
              onChange={(e) => {
                if (!e.target.value) return;
                const d = lunarCalendarService.parseLocalDate(e.target.value);
                setSelected(d);
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            />
          </label>
        </aside>
      </div>
    </div>
  );
}
