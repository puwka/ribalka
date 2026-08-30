import { useState, useEffect } from 'react';

export const usePermTime = () => {
  const [timeData, setTimeData] = useState({
    time: '',
    seconds: '',
    date: '',
    weekday: '',
    day: '',
    month: '',
    year: ''
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Время в Перми (Asia/Yekaterinburg = МСК+2)
      const options = { timeZone: 'Asia/Yekaterinburg' };
      
      // Часы и минуты
      const timeStr = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(now);
      
      // Секунды отдельно (для мигающего эффекта)
      const seconds = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        second: '2-digit'
      }).format(now);
      
      // День недели
      const weekday = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        weekday: 'long'
      }).format(now);
      
      // Число
      const day = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        day: 'numeric'
      }).format(now);
      
      // Месяц
      const month = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        month: 'long'
      }).format(now);
      
      // Год
      const year = new Intl.DateTimeFormat('ru-RU', {
        ...options,
        year: 'numeric'
      }).format(now);
      
      // Полная дата
      const date = `${day} ${month} ${year}`;
      
      setTimeData({
        time: timeStr,
        seconds,
        date,
        weekday,
        day,
        month,
        year
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return timeData;
};