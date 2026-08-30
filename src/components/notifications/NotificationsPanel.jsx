import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  notificationService,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../../services/notificationService';
import { digestBuilder } from '../../services/email/digestBuilder';
import { emailOutbox } from '../../services/email/emailOutbox';
import '../auth/AuthShared.css';
import './NotificationsPanel.css';

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

const IN_APP_OPTS = [
  ['system', 'Системные'],
  ['booking', 'Бронирования'],
  ['report', 'Новые отчёты'],
  ['favorite', 'Избранные места'],
  ['owner', 'Владельцу'],
  ['moderation', 'Модерация'],
  ['forum', 'Форум'],
  ['achievement', 'Достижения'],
];

const EMAIL_OPTS = [
  ['weeklyDigest', 'Еженедельный дайджест'],
  ['newBases', 'Новые базы'],
  ['biteForecast', 'Прогноз клёва'],
  ['news', 'Новости'],
];

export default function NotificationsPanel() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');

  const load = () => {
    if (!user) return;
    setItems(notificationService.list(user.id));
    setSettings(notificationService.getSettings(user.id));
  };

  useEffect(load, [user]);

  const markOne = async (id) => {
    notificationService.markRead(user.id, id);
    load();
    await refresh();
  };

  const markAll = async () => {
    notificationService.markAllRead(user.id);
    load();
    await refresh();
  };

  const removeOne = async (id) => {
    notificationService.remove(user.id, id);
    load();
    await refresh();
  };

  const saveSettings = async (next) => {
    setSettings(notificationService.saveSettings(user.id, next));
    setMessage('Настройки сохранены');
  };

  const previewDigest = async () => {
    const payload = await digestBuilder.weeklyDigest(user.id);
    notificationService.queueEmail(user.id, 'weeklyDigest', payload);
    setMessage(`Дайджест поставлен в очередь email (${emailOutbox.list().length} в outbox)`);
  };

  const filtered = items.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="cabinet-panel ntf-page">
      <h2>Центр уведомлений</h2>
      <p className="cabinet-panel__lead">
        Непрочитанных: <strong>{unread}</strong>. Управляйте inbox и каналами доставки.
      </p>

      <div className="ntf-page__tabs">
        <button type="button" className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
          Inbox
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
        >
          Настройки
        </button>
        <button type="button" className={tab === 'email' ? 'active' : ''} onClick={() => setTab('email')}>
          Email
        </button>
      </div>

      {message && <div className="ntf-page__msg">{message}</div>}

      {tab === 'inbox' && (
        <>
          <div className="cabinet-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn-secondary" onClick={markAll}>
              Прочитать все
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                notificationService.clearRead(user.id);
                load();
                await refresh();
              }}
            >
              Очистить прочитанные
            </button>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Все</option>
              <option value="unread">Непрочитанные</option>
              {Object.keys(TYPE_LABEL).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="cabinet-list">
            {filtered.length === 0 && <div className="empty-state">Нет уведомлений</div>}
            {filtered.map((n) => (
              <div key={n.id} className={`cabinet-item ${n.is_read ? '' : 'ntf-unread'}`}>
                <div className="cabinet-item__title">
                  <span className="ntf-chip">{TYPE_LABEL[n.type] || n.type}</span> {n.title}
                </div>
                <div className="cabinet-item__meta">
                  {n.body}
                  <br />
                  {new Date(n.created_at).toLocaleString('ru-RU')}
                </div>
                <div className="cabinet-actions">
                  {n.link_path && (
                    <Link className="btn-secondary" to={n.link_path} onClick={() => markOne(n.id)}>
                      Открыть
                    </Link>
                  )}
                  {!n.is_read && (
                    <button type="button" className="btn-secondary" onClick={() => markOne(n.id)}>
                      Прочитано
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => removeOne(n.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <div className="ntf-settings">
          <h3>В приложении</h3>
          {IN_APP_OPTS.map(([key, label]) => (
            <label key={key} className="ntf-switch">
              <input
                type="checkbox"
                checked={settings.inApp[key] !== false}
                onChange={(e) =>
                  saveSettings({ inApp: { ...settings.inApp, [key]: e.target.checked } })
                }
              />
              {label}
            </label>
          ))}

          <h3>Push в браузере</h3>
          <label className="ntf-switch">
            <input
              type="checkbox"
              checked={Boolean(settings.push?.enabled)}
              onChange={async (e) => {
                if (e.target.checked) {
                  const res = await notificationService.requestPushPermission(user.id);
                  setMessage(
                    res.ok
                      ? 'Разрешение на уведомления получено'
                      : `Push недоступен: ${res.permission || res.reason}`
                  );
                  load();
                } else {
                  saveSettings({ push: { enabled: false } });
                }
              }}
            />
            Показывать системные push при новых событиях
          </label>
        </div>
      )}

      {tab === 'email' && (
        <div className="ntf-settings">
          <h3>Email-рассылки (архитектура)</h3>
          <p className="cabinet-panel__lead">
            Подписки сохраняются локально. Отправка через Resend/SMTP и Edge Function
            `send-email` — outbox уже готов.
          </p>
          {EMAIL_OPTS.map(([key, label]) => (
            <label key={key} className="ntf-switch">
              <input
                type="checkbox"
                checked={settings.email[key] !== false}
                onChange={(e) =>
                  saveSettings({ email: { ...settings.email, [key]: e.target.checked } })
                }
              />
              {label}
            </label>
          ))}
          <div className="cabinet-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={previewDigest}>
              Поставить недельный дайджест в outbox
            </button>
          </div>
          <p className="cabinet-panel__lead" style={{ marginTop: 12 }}>
            В очереди: {emailOutbox.list().length} писем
          </p>
        </div>
      )}
    </div>
  );
}
