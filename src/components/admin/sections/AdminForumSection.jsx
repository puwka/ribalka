import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forumService } from '../../../services/forumService';
import { AdminPageHead, AdminAlert, AdminStatus } from '../AdminUI';

export default function AdminForumSection() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setItems(await forumService.listForModeration(filter));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

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
      await load();
    } catch (err) {
      setError(err.message);
    }
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
        {items.length === 0 ? (
          <div className="admin-empty">Нет записей</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Содержание</th>
                  <th>Автор</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item._type}-${item.id}`}>
                    <td>{item._type === 'topic' ? 'Тема' : 'Сообщение'}</td>
                    <td>
                      {item._type === 'topic' ? item.title : (item.body || '').slice(0, 120)}
                    </td>
                    <td>{item.authorName}</td>
                    <td>
                      <AdminStatus status={item.status}>
                        {{
                          pending: 'На модерации',
                          approved: 'Одобрено',
                          rejected: 'Отклонено',
                          hidden: 'Скрыто',
                        }[item.status] || item.status}
                      </AdminStatus>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        {item._type === 'topic' ? (
                          <>
                            <Link to={`/forum/${item.id}`} className="admin-btn admin-btn--sm">Открыть</Link>
                            <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => actTopic(item.id, 'approve')}>Одобрить</button>
                            <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => actTopic(item.id, 'reject')}>Отклонить</button>
                            <button type="button" className="admin-btn admin-btn--sm" onClick={() => actTopic(item.id, 'lock')}>Закрыть</button>
                            <button type="button" className="admin-btn admin-btn--sm" onClick={() => actTopic(item.id, 'pin')}>Закрепить</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => actMessage(item.id, 'approve')}>Одобрить</button>
                            <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => actMessage(item.id, 'hide')}>Скрыть</button>
                          </>
                        )}
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
