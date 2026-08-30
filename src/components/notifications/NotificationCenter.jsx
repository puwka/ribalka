import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { notificationService } from '../../services/notificationService';
import './NotificationCenter.css';

const TYPE_LABEL = {
  system: 'Система',
  booking: 'Бронь',
  report: 'Отчёт',
  favorite: 'Избранное',
  owner: 'Владельцу',
  moderation: 'Модерация',
  forum: 'Форум',
  achievement: 'Достижение',
  comment: 'Комментарий',
  subscription: 'Подписка',
};

export default function NotificationCenter() {
  const { user, isAuthenticated, notifications, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const list = notifications || [];
  const unread = list.filter((n) => !n.is_read).length;

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!isAuthenticated || !user) return null;

  const markOne = async (id) => {
    notificationService.markRead(user.id, id);
    await refresh();
  };

  const markAll = async () => {
    notificationService.markAllRead(user.id);
    await refresh();
  };

  const openItem = async (n) => {
    if (!n.is_read) await markOne(n.id);
    setOpen(false);
    if (n.link_path) navigate(n.link_path);
  };

  return (
    <div className="ntf-center" ref={ref}>
      <button
        type="button"
        className="ntf-center__bell"
        aria-label={`Уведомления${unread ? `, непрочитанных ${unread}` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="ntf-center__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="ntf-center__panel" role="dialog" aria-label="Центр уведомлений">
          <div className="ntf-center__head">
            <strong>Уведомления</strong>
            <div className="ntf-center__head-actions">
              {unread > 0 && (
                <button type="button" onClick={markAll}>
                  Прочитать все
                </button>
              )}
              <Link to="/cabinet/notifications" onClick={() => setOpen(false)}>
                Все / настройки
              </Link>
            </div>
          </div>

          <ul className="ntf-center__list">
            {list.length === 0 && <li className="ntf-center__empty">Пока тихо</li>}
            {list.slice(0, 12).map((n) => (
              <li key={n.id} className={n.is_read ? 'is-read' : 'is-unread'}>
                <button type="button" className="ntf-center__item" onClick={() => openItem(n)}>
                  <span className="ntf-center__type">{TYPE_LABEL[n.type] || n.type}</span>
                  <span className="ntf-center__title">{n.title}</span>
                  {n.body && <span className="ntf-center__body">{n.body}</span>}
                  <span className="ntf-center__time">
                    {new Date(n.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
