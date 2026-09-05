import { useState, useEffect } from 'react';
import { resolveLatLng } from '../lib/coords';

// Маппинг WMO кодов погоды на иконки и описания
const weatherCodes = {
  0: { icon: '☀️', desc: 'Ясно' },
  1: { icon: '🌤️', desc: 'Преимущественно ясно' },
  2: { icon: '⛅', desc: 'Переменная облачность' },
  3: { icon: '☁️', desc: 'Пасмурно' },
  45: { icon: '🌫️', desc: 'Туман' },
  48: { icon: '🌫️', desc: 'Изморозь' },
  51: { icon: '🌦️', desc: 'Лёгкая морось' },
  53: { icon: '🌦️', desc: 'Морось' },
  55: { icon: '🌧️', desc: 'Сильная морось' },
  61: { icon: '🌧️', desc: 'Небольшой дождь' },
  63: { icon: '🌧️', desc: 'Дождь' },
  65: { icon: '🌧️', desc: 'Сильный дождь' },
  71: { icon: '🌨️', desc: 'Небольшой снег' },
  73: { icon: '🌨️', desc: 'Снег' },
  75: { icon: '❄️', desc: 'Сильный снег' },
  77: { icon: '❄️', desc: 'Снежные зёрна' },
  80: { icon: '🌦️', desc: 'Ливень' },
  81: { icon: '🌧️', desc: 'Сильный ливень' },
  82: { icon: '⛈️', desc: 'Очень сильный ливень' },
  85: { icon: '🌨️', desc: 'Снегопад' },
  86: { icon: '❄️', desc: 'Сильный снегопад' },
  95: { icon: '⛈️', desc: 'Гроза' },
  96: { icon: '⛈️', desc: 'Гроза с градом' },
  99: { icon: '⛈️', desc: 'Сильная гроза' }
};

export const useWeather = (coords) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coords) return;

    const { lat, lng: lon } = typeof coords === 'string'
      ? resolveLatLng({ coords })
      : resolveLatLng(coords);
    if (lat == null || lon == null) {
      setError('Неверные координаты');
      return;
    }

    // Проверяем кэш (30 минут)
    const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        setWeather(data);
        return;
      }
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Yekaterinburg&forecast_days=3`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки погоды');
        
        const data = await response.json();
        
        // Форматируем данные
        const formatted = {
          current: {
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
            icon: weatherCodes[data.current.weather_code]?.icon || '❓',
            desc: weatherCodes[data.current.weather_code]?.desc || 'Нет данных',
            wind: Math.round(data.current.wind_speed_10m),
            humidity: data.current.relative_humidity_2m
          },
          daily: data.daily.time.map((date, i) => ({
            date,
            code: data.daily.weather_code[i],
            icon: weatherCodes[data.daily.weather_code[i]]?.icon || '❓',
            desc: weatherCodes[data.daily.weather_code[i]]?.desc || '',
            max: Math.round(data.daily.temperature_2m_max[i]),
            min: Math.round(data.daily.temperature_2m_min[i])
          }))
        };

        setWeather(formatted);
        
        // Сохраняем в кэш
        localStorage.setItem(cacheKey, JSON.stringify({
          data: formatted,
          timestamp: Date.now()
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [coords]);

  return { weather, loading, error };
};