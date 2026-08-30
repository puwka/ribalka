import { useWeather } from '../../hooks/useWeather';
import './WeatherWidget.css';

export default function WeatherWidget({ coords }) {
  const { weather, loading, error } = useWeather(coords);

  // Форматирование даты
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
    
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="weather-widget weather-widget--loading">
        <div className="weather-skeleton"></div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="weather-widget weather-widget--error">
        <span>🌍</span>
        <span>Погода недоступна</span>
      </div>
    );
  }

  return (
    <div className="weather-widget">
      <div className="weather-widget__header">
        <h4>🌤️ Погода на месте</h4>
        <span className="weather-widget__now">Сейчас</span>
      </div>

      {/* Текущая погода */}
      <div className="weather-current">
        <div className="weather-current__icon">{weather.current.icon}</div>
        <div className="weather-current__info">
          <div className="weather-current__temp">{weather.current.temp}°C</div>
          <div className="weather-current__desc">{weather.current.desc}</div>
        </div>
        <div className="weather-current__details">
          <div className="weather-detail">
            <span className="weather-detail__icon">💨</span>
            <span>{weather.current.wind} м/с</span>
          </div>
          <div className="weather-detail">
            <span className="weather-detail__icon">💧</span>
            <span>{weather.current.humidity}%</span>
          </div>
        </div>
      </div>

      {/* Прогноз на 3 дня */}
      <div className="weather-forecast">
        {weather.daily.map((day, i) => (
          <div key={i} className="weather-day">
            <div className="weather-day__date">{formatDate(day.date)}</div>
            <div className="weather-day__icon">{day.icon}</div>
            <div className="weather-day__temps">
              <span className="temp-max">{day.max}°</span>
              <span className="temp-min">{day.min}°</span>
            </div>
          </div>
        ))}
      </div>

      {/* Подсказка для рыбалки */}
      <div className="weather-tip">
        {getFishingTip(weather.current)}
      </div>
    </div>
  );
}

// Функция для подсказки о клёве
function getFishingTip(current) {
  const { temp, wind, code } = current;
  
  if (code >= 95) return '⚠️ Гроза — рыбалка опасна!';
  if (wind > 10) return '💨 Сильный ветер — клёв может быть слабым';
  if (temp < 0) return '❄️ Зимняя рыбалка — одевайтесь теплее!';
  if (temp >= 15 && temp <= 25 && wind < 5) return '🎣 Отличные условия для рыбалки!';
  if (code >= 61 && code <= 65) return '🌧️ После дождя клёв часто улучшается';
  if (code === 0 || code === 1) return '☀️ Ясная погода — берите очки и крем';
  
  return '🐟 Удачной рыбалки!';
}