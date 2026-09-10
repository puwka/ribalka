import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forumService } from '../../../services/forumService';
import { AdminPageHead, AdminAlert, AdminStatus } from '../AdminUI';

export default function AdminForumSection() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgFilter, setMsgFilter] = useState('pending');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setItems(await forumService.listForModeration(filter));
    } catch (err) {
      setError(err.message);
    }
  };

  const loadMessages = async () => {
    try {
      setMessages(await forumService.listPendingMessages(msgFilter));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  useEffect(() => {
    loadMessages();
  }, [msgFilter]);

  const actTopic = async (id, action) => {
    const note = action === 'reject' ? window.prompt('Причина') || '' : '';
    try {
      await forumService.moderateTopic(user.id, id, { action, note });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const actMessage = async (id, action) => {
    try {
      await forumService.moderateMessage(user.id, id, { action });
      await loadMessages();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
    setExpandedId(item.id);
  };

  const saveEdit = async (id) => {
    try {
      await forumService.updateTopic(id, { title: editTitle, body: editBody }, { isAdmin: true });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <AdminPageHead title="Форум" subtitle="Модерация тем и сообщений" />
      <AdminAlert type="error">{error}</AdminAlert>

      <div className="admin-toolbar">
        {[
          { id: 'pending', label: 'На модерации' },
          { id: 'approved', label: 'Одобренные' },
          { id: 'rejected', label: 'Отклонённые' },
          { id: 'hidden', label: 'Скрытые' },
          { id: 'all', label: 'Все' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            className={`admin-btn ${filter === s.id ? 'admin-btn--primary' : ''}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <section className="admin-panel">
        <h3>Темы</h3>
        {items.length === 0 ? (
          <div className="admin-empty">Нет тем</div>
        ) : (
          <div className="admin-accordion">
            {items.map((item) => (
              <div key={item.id} className="admin-accordion__item">
                <button
                  type="button"
                  className="admin-accordion__head"
                  onClick={() => toggleExpand(item.id)}
                >
                  <span>{item.title}</span>
                  <AdminStatus status={item.status}>
                    {{
                      pending: 'На модерации',
                      approved: 'Одобрено',
                      rejected: 'Отклонено',
                      hidden: 'Скрыто',
                    }[item.status] || item.status}
                  </AdminStatus>
                </button>

                {expandedId === item.id && (
                  <div className="admin-accordion__body">
                    {editingId === item.id ? (
                      <>
                        <label>
                          Заголовок
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        </label>
                        <label>
                          Текст
                          <textarea
                            rows={8}
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                          />
                        </label>
                        <div className="admin-table__actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary admin-btn--sm"
                            onClick={() => saveEdit(item.id)}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => setEditingId(null)}
                          >
                            Отмена
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="admin-accordion__meta">
                          {item.authorName} · {new Date(item.createdAt).toLocaleString('ru-RU')}
                        </p>
                        <p className="admin-accordion__text">{item.body}</p>
                      </>
                    )}

                    <div className="admin-table__actions">
                      <Link to={`/forum/${item.id}`} className="admin-btn admin-btn--sm">
                        Открыть
                      </Link>
                      {editingId !== item.id && (
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm"
                          onClick={() => startEdit(item)}
                        >
                          Редактировать
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        onClick={() => actTopic(item.id, 'approve')}
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        onClick={() => actTopic(item.id, 'reject')}
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => actTopic(item.id, 'lock')}
                      >
                        Закрыть
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => actTopic(item.id, 'pin')}
                      >
                        Закрепить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <h3>Сообщения на модерации</h3>
        <div className="admin-toolbar">
          {[
            { id: 'pending', label: 'На модерации' },
            { id: 'approved', label: 'Одобренные' },
            { id: 'hidden', label: 'Скрытые' },
            { id: 'all', label: 'Все' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              className={`admin-btn ${msgFilter === s.id ? 'admin-btn--primary' : ''}`}
              onClick={() => setMsgFilter(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {messages.length === 0 ? (
          <div className="admin-empty">Нет сообщений</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Тема</th>
                  <th>Текст</th>
                  <th>Автор</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.topicTitle || '—'}</td>
                    <td>{(m.body || '').slice(0, 160)}</td>
                    <td>{m.authorName}</td>
                    <td>
                      <AdminStatus status={m.status}>
                        {{
                          pending: 'На модерации',
                          approved: 'Одобрено',
                          hidden: 'Скрыто',
                        }[m.status] || m.status}
                      </AdminStatus>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <Link to={`/forum/${m.topicId}`} className="admin-btn admin-btn--sm">
                          Тема
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--primary"
                          onClick={() => actMessage(m.id, 'approve')}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--danger"
                          onClick={() => actMessage(m.id, 'hide')}
                        >
                          Скрыть
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
