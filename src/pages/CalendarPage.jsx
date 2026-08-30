import { useState, useMemo } from 'react';
import { 
  getFishingBans, 
  fishingSeasons, 
  getEvents, 
  getMoonPhases,
  monthNames,
  monthNamesShort,
  dayNames,
  getCurrentYear
} from '../data/calendarData';
import './CalendarPage.css';

export default function CalendarPage() {
  const currentYear = getCurrentYear();
  const today = new Date();
  
  const fishingBans = useMemo(() => getFishingBans(currentYear), [currentYear]);
  const events = useMemo(() => getEvents(currentYear), [currentYear]);
  const moonPhases = useMemo(() => getMoonPhases(currentYear), [currentYear]);

  const [currentDate, setCurrentDate] = useState(new Date(currentYear, today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedFish, setSelectedFish] = useState('all');
  const [viewMode, setViewMode] = useState('calendar');

  const viewYear = currentDate.getFullYear();
  const viewMonth = currentDate.getMonth();

  // Генерация дней месяца
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const days = [];

    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(viewYear, viewMonth, -i), isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(viewYear, viewMonth, i), isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(viewYear, viewMonth + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Получение информации о дне
  const getDayInfo = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const info = {
      isToday: date.toDateString() === today.toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      bans: [],
      events: [],
      moonPhase: null,
      fishingQuality: null
    };

    // Проверка запретов — показываем только запреты на рыбу
    fishingBans.forEach(ban => {
      if (date >= new Date(ban.startDate) && date <= new Date(ban.endDate)) {
        // Если выбран конкретный вид рыбы
        if (selectedFish !== 'all') {
          const selectedFishName = fishingSeasons[selectedFish]?.name;
          // Показываем запрет только если он для выбранной рыбы
          if (ban.fish === selectedFishName) {
            info.bans.push(ban);
          }
        } else {
          // Если выбрано "все рыбы" — показываем ВСЕ запреты на рыбу
          info.bans.push(ban);
        }
      }
    });

    // Проверка событий
    events.forEach(event => {
      if (event.date === dateStr) {
        info.events.push(event);
      }
    });

    // Фаза луны
    if (moonPhases[dateStr]) {
      info.moonPhase = moonPhases[dateStr];
    }

    // Качество клёва (только если нет запрета)
    if (info.bans.length === 0 && selectedFish !== 'all' && fishingSeasons[selectedFish]) {
      const season = fishingSeasons[selectedFish];
      const month = date.getMonth() + 1;
      if (season.bestMonths.includes(month)) {
        info.fishingQuality = 'excellent';
      } else if (season.goodMonths.includes(month)) {
        info.fishingQuality = 'good';
      } else {
        info.fishingQuality = 'poor';
      }
    }

    return info;
  };

  const prevMonth = () => setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date(currentYear, today.getMonth(), 1));
    setSelectedDate(today);
  };

  // События месяца
  const monthEvents = useMemo(() => {
    const result = [];
    
    fishingBans.forEach(ban => {
      const startDate = new Date(ban.startDate);
      const endDate = new Date(ban.endDate);
      const monthStart = new Date(viewYear, viewMonth, 1);
      const monthEnd = new Date(viewYear, viewMonth + 1, 0);
      
      if (startDate <= monthEnd && endDate >= monthStart) {
        if (selectedFish === 'all' || 
            (selectedFish !== 'all' && fishingSeasons[selectedFish]?.name === ban.fish)) {
          result.push({ ...ban, type: 'ban' });
        }
      }
    });

    events.forEach(event => {
      const eventDate = new Date(event.date);
      if (eventDate.getMonth() === viewMonth && eventDate.getFullYear() === viewYear) {
        result.push({ ...event, type: 'event' });
      }
    });

    return result.sort((a, b) => {
      const dateA = a.startDate || a.date;
      const dateB = b.startDate || b.date;
      return new Date(dateA) - new Date(dateB);
    });
  }, [viewYear, viewMonth, selectedFish, fishingBans, events]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const selectedDateInfo = selectedDate ? getDayInfo(selectedDate) : null;

  // Подсчёт активных запретов на сегодня
  const activeBansCount = useMemo(() => {
    return fishingBans.filter(ban => {
      const today = new Date();
      return today >= new Date(ban.startDate) && today <= new Date(ban.endDate);
    }).length;
  }, [fishingBans]);

  return (
    <div className="calendar-page">
      {/* Шапка */}
      <header className="calendar-header">
        <div className="calendar-header__container">
          <div className="calendar-header__top">
            <div className="calendar-header__badge">
              ОФИЦИАЛЬНЫЙ КАЛЕНДАРЬ • {currentYear}
            </div>
            {activeBansCount > 0 && (
              <div className="active-bans-badge">
                <span className="badge-icon">⚠</span>
                <span>Активных запретов: {activeBansCount}</span>
              </div>
            )}
          </div>
          <h1>Календарь рыболова</h1>
          <p className="calendar-header__subtitle">
            Нерестовые запреты, сезоны клёва и спортивные события Пермского края
          </p>
          <p style={{ marginTop: 12 }}>
            <a href="/lunar" style={{ color: '#bfdbfe', fontWeight: 700 }}>
              Открыть лунный календарь клёва →
            </a>
          </p>
        </div>
      </header>

      <div className="calendar-container">
        {/* Панель управления */}
        <div className="calendar-controls">
          <div className="control-group">
            <label className="control-label">Вид рыбы</label>
            <select 
              value={selectedFish}
              onChange={(e) => setSelectedFish(e.target.value)}
              className="fish-filter"
            >
              <option value="all">Все виды рыб</option>
              {Object.entries(fishingSeasons).map(([key, fish]) => (
                <option key={key} value={key}>{fish.name}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Режим</label>
            <div className="view-toggle">
              <button 
                className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                Календарь
              </button>
              <button 
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                Список
              </button>
            </div>
          </div>

          <button className="today-btn" onClick={goToToday}>
            Сегодня
          </button>
        </div>

        {/* Легенда */}
        <div className="calendar-legend">
          <div className="legend-title">Обозначения:</div>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-color legend-ban"></span>
              <span>Запрет</span>
            </div>
            <div className="legend-item">
              <span className="legend-color legend-excellent"></span>
              <span>Отличный клёв</span>
            </div>
            <div className="legend-item">
              <span className="legend-color legend-good"></span>
              <span>Хороший клёв</span>
            </div>
            <div className="legend-item">
              <span className="legend-color legend-poor"></span>
              <span>Слабый клёв</span>
            </div>
            <div className="legend-item">
              <span className="legend-color legend-event"></span>
              <span>Событие</span>
            </div>
          </div>
        </div>

        {/* Основной контент */}
        {viewMode === 'calendar' ? (
          <div className="calendar-main">
            {/* Календарь */}
            <div className="calendar-view">
              <div className="calendar-nav">
                <button className="nav-btn" onClick={prevMonth}>←</button>
                <h2 className="current-month">
                  {monthNames[viewMonth]} <span className="current-year">{viewYear}</span>
                </h2>
                <button className="nav-btn" onClick={nextMonth}>→</button>
              </div>

              <div className="calendar-grid">
                {dayNames.map(day => (
                  <div key={day} className="calendar-day-name">{day}</div>
                ))}

                {daysInMonth.map((day, index) => {
                  const info = getDayInfo(day.date);
                  const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();
                  
                  let dayClass = 'calendar-day';
                  if (!day.isCurrentMonth) dayClass += ' other-month';
                  if (info.isToday) dayClass += ' today';
                  if (isSelected) dayClass += ' selected';
                  if (info.bans.length > 0) dayClass += ' has-ban';
                  else if (info.fishingQuality === 'excellent') dayClass += ' excellent';
                  else if (info.fishingQuality === 'good') dayClass += ' good';
                  else if (info.fishingQuality === 'poor') dayClass += ' poor';
                  if (info.events.length > 0) dayClass += ' has-event';

                  return (
                    <div
                      key={index}
                      className={dayClass}
                      onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                    >
                      <span className="day-number">{day.date.getDate()}</span>
                      <div className="day-indicators">
                        {info.bans.length > 0 && <span className="indicator ban-indicator" title="Запрет">🚫</span>}
                        {info.events.length > 0 && <span className="indicator event-indicator" title="Событие">🎯</span>}
                        {info.moonPhase && (
                          <span className="indicator moon-indicator" title={info.moonPhase.name}>
                            {info.moonPhase.phase === 'full' ? '🌕' : '🌑'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Информация о выбранном дне */}
            {selectedDate && selectedDateInfo && (
              <div className="selected-day-info">
                <div className="selected-day-header">
                  <h3>
                    {selectedDate.toLocaleDateString('ru-RU', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h3>
                  <button className="close-btn" onClick={() => setSelectedDate(null)}>✕</button>
                </div>

                {selectedDateInfo.bans.length > 0 && (
                  <div className="info-section bans-section">
                    <h4>⚠️ Нерестовые запреты</h4>
                    {selectedDateInfo.bans.map(ban => (
                      <div key={ban.id} className="info-card ban-card">
                        <div className="info-card__header">
                          <strong>{ban.name}</strong>
                          <span className="info-card__region">{ban.region}</span>
                        </div>
                        <p>{ban.description}</p>
                        <div className="info-card__period">
                          {formatDate(ban.startDate)} — {formatDate(ban.endDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateInfo.events.length > 0 && (
                  <div className="info-section events-section">
                    <h4>🎯 События</h4>
                    {selectedDateInfo.events.map(event => (
                      <div key={event.id} className="info-card event-card">
                        <div className="info-card__header">
                          <strong>{event.name}</strong>
                          <span className="info-card__region">{event.location}</span>
                        </div>
                        <p>{event.description}</p>
                        <div className="info-card__period">
                          Организатор: {event.organizer}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateInfo.moonPhase && (
                  <div className="info-section moon-section">
                    <h4>🌙 Фаза луны</h4>
                    <div className="moon-info">
                      <span className="moon-icon">
                        {selectedDateInfo.moonPhase.phase === 'full' ? '🌕' : '🌑'}
                      </span>
                      <div>
                        <strong>{selectedDateInfo.moonPhase.name}</strong>
                        <p>
                          {selectedDateInfo.moonPhase.phase === 'full' 
                            ? 'Клёв может быть слабым'
                            : 'Хороший клёв хищной рыбы'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDateInfo.fishingQuality && selectedFish !== 'all' && (
                  <div className="info-section fishing-section">
                    <h4>🎣 Качество клёва</h4>
                    <div className={`fishing-quality quality-${selectedDateInfo.fishingQuality}`}>
                      {selectedDateInfo.fishingQuality === 'excellent' && '⭐ Отличный клёв!'}
                      {selectedDateInfo.fishingQuality === 'good' && '✨ Хороший клёв'}
                      {selectedDateInfo.fishingQuality === 'poor' && '⚠️ Слабый клёв'}
                    </div>
                  </div>
                )}

                {selectedDateInfo.bans.length === 0 && 
                    selectedDateInfo.events.length === 0 && 
                    !selectedDateInfo.moonPhase && 
                    !selectedDateInfo.fishingQuality && (
                  <div className="info-section empty-section">
                    <p>Особых ограничений и событий не зафиксировано</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="list-view">
            <h2 className="list-title">
              События: {monthNames[viewMonth]} {viewYear}
            </h2>

            {monthEvents.length === 0 ? (
              <div className="no-events">
                <p>Событий не зафиксировано</p>
              </div>
            ) : (
              <div className="events-list">
                {monthEvents.map((item, index) => (
                  <div key={index} className={`event-item event-item--${item.type}`}>
                    <div className="event-item__marker">
                      {item.type === 'ban' ? '⚠️' : '🎯'}
                    </div>
                    <div className="event-item__content">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="event-item__meta">
                        {item.type === 'ban' ? (
                          <>
                            <span>{formatDate(item.startDate)} — {formatDate(item.endDate)}</span>
                            <span>{item.region}</span>
                          </>
                        ) : (
                          <>
                            <span>{formatDate(item.date)}</span>
                            <span>{item.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Таблица сезонов */}
        <div className="fishing-seasons">
          <h2>Сезоны клёва рыб</h2>
          <div className="seasons-table-wrapper">
            <table className="seasons-table">
              <thead>
                <tr>
                  <th>Вид рыбы</th>
                  {monthNamesShort.map((m, i) => (
                    <th key={i}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(fishingSeasons).map(([key, fish]) => (
                  <tr 
                    key={key} 
                    className={`season-row ${selectedFish === key ? 'selected' : ''}`}
                    onClick={() => setSelectedFish(selectedFish === key ? 'all' : key)}
                  >
                    <td className="fish-name">
                      <strong>{fish.name}</strong>
                      <em>{fish.latin}</em>
                    </td>
                    {monthNamesShort.map((_, i) => {
                      const monthNum = i + 1;
                      let quality = 'poor';
                      if (fish.bestMonths.includes(monthNum)) quality = 'best';
                      else if (fish.goodMonths.includes(monthNum)) quality = 'good';
                      
                      return (
                        <td key={i} className={`season-cell season-${quality}`}>
                          <span className="cell-indicator"></span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="seasons-legend">
            <div className="season-legend-item">
              <span className="season-color season-best"></span>
              <span>Оптимальный</span>
            </div>
            <div className="season-legend-item">
              <span className="season-color season-good"></span>
              <span>Хороший</span>
            </div>
            <div className="season-legend-item">
              <span className="season-color season-poor"></span>
              <span>Слабый</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}