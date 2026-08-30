import { useLocation, useNavigate } from 'react-router-dom';

export const useSmartNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Универсальная функция навигации
  const navigateTo = (target) => {
    // 1. Переход на главную с прокруткой вверх
    if (target === '/') {
      if (location.pathname !== '/') {
        navigate('/');
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
      return;
    }

    // 2. Переход на другую страницу (без якоря)
    if (target.startsWith('/') && !target.includes('#')) {
      navigate(target);
      return;
    }

    // 3. Якорь на текущей странице (#paid, #free, #news, #contacts)
    if (target.startsWith('#')) {
      const elementId = target.replace('#', '');
      
      if (location.pathname !== '/') {
        navigate(`/#${elementId}`);
      } else {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return;
    }

    // 4. Страница с якорем (/reports#reports-top, /about#about-top)
    if (target.includes('#')) {
      const [path, anchor] = target.split('#');
      navigate(`${path}#${anchor}`);
      return;
    }
  };

  // Обработчик для ссылок
  const handleClick = (e, target) => {
    e.preventDefault();
    navigateTo(target);
  };

  return { navigateTo, handleClick };
};