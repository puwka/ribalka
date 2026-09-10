import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { reportSocialService } from '../../../services/reportSocialService';
import { AdminPageHead, AdminAlert, AdminStatus } from '../AdminUI';

const STATUS_LABELS = {
  pending: 'На модерации',
  approved: 'Одобрен',
  rejected: 'Отклонён',
  hidden: 'Скрыт',
};

export default function AdminReportsSection() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentFilter, setCommentFilter] = useState('pending');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await reportSocialService.listForModeration(filter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      setComments(await reportSocialService.listPendingComments(commentFilter));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    setSelected(null);
    setSelectedId(null);
    setEditing(false);
    setEditForm(null);
    load();
  }, [filter]);

  useEffect(() => {
    loadComments();
  }, [commentFilter]);

  const openItem = useCallback(
    async (id) => {
      const key = String(id);
      setSelectedId(key);
      setError('');
      setMessage('');
      setEditing(false);
      const fromList = items.find((r) => String(r.id) === key);
      try {
        const row = await reportSocialService.getForModeration(id);
        setSelected(row);
        setEditForm({
          place: row.place || '',
          date: row.date || '',
          fish: row.fish || '',
          bait: row.bait || '',
          weight: row.weight || '',
          description: row.description || '',
        });
      } catch (err) {
        if (fromList) {
          setSelected(fromList);
          setEditForm({
            place: fromList.place || '',
            date: fromList.date || '',
            fish: fromList.fish || '',
            bait: fromList.bait || '',
            weight: fromList.weight || '',
            description: fromList.description || '',
          });
        } else {
          setSelected(null);
          setError(err.message || 'Отчёт не найден');
        }
      }
    },
    [items]
  );

  useEffect(() => {
    const id = searchParams.get('open') || searchParams.get('id');
    if (!id || loading) return;
    const inList = items.some((r) => String(r.id) === String(id));
    if (!inList) {
      if (searchParams.get('open') || searchParams.get('id')) {
        const next = new URLSearchParams(searchParams);
        next.delete('open');
        next.delete('id');
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (String(selectedId) === String(id) && selected) return;
    openItem(id);
  }, [searchParams, items, loading, selectedId, selected, openItem, setSearchParams]);

  const clearOpenParam = () => {
    if (!searchParams.get('open') && !searchParams.get('id')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    next.delete('id');
    setSearchParams(next, { replace: true });
  };

  const act = async (id, action) => {
    if (!user?.id) {
      setError('Войдите как администратор');
      return;
    }
    const note = action === 'reject' ? window.prompt('Причина отклонения') || '' : '';
    setError('');
    setMessage('');
    try {
      await reportSocialService.moderate(user.id, id, { action, note });
      setMessage(action === 'approve' ? 'Отчёт одобрен' : 'Статус обновлён');
      setSelected(null);
      setSelectedId(null);
      clearOpenParam();
      setItems((prev) => prev.filter((r) => String(r.id) !== String(id)));
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось изменить статус');
    }
  };

  const saveEdit = async () => {
    if (!selected || !editForm || !user?.id) return;
    setError('');
    setMessage('');
    try {
      const updated = await reportSocialService.update(selected.id, {
        ...editForm,
        isAdmin: true,
        authorUserId: user.id,
      });
      setSelected(updated);
      setEditing(false);
      setMessage('Отчёт обновлён');
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
    }
  };

  const actComment = async (commentId, action) => {
    try {
      await reportSocialService.moderateComment(user.id, commentId, { action });
      await loadComments();
      setMessage('Комментарий обновлён');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <AdminPageHead title="Отчёты" subtitle="Модерация отчётов о рыбалке" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

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

      {loading ? (
        <div className="admin-empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <section className="admin-panel">
          <div className="admin-empty">Нет записей</div>
        </section>
      ) : (
        <div className="admin-split">
          <div>
            {items.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`admin-list-item${String(selectedId) === String(r.id) ? ' is-active' : ''}`}
                onClick={() => openItem(r.id)}
              >
                <div className="admin-list-item__title">{r.place || 'Без места'}</div>
                <div className="admin-list-item__meta">
                  <AdminStatus status={r.status}>{STATUS_LABELS[r.status] || r.status}</AdminStatus>
                  {' · '}
                  {r.author}
                  {' · '}
                  {r.date}
                </div>
              </button>
            ))}
          </div>

          <div className="admin-panel">
            {!selected ? (
              <div className="admin-empty">Выберите отчёт</div>
            ) : (
              <>
                <h3>{selected.place}</h3>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>
                  <AdminStatus status={selected.status}>
                    {STATUS_LABELS[selected.status] || selected.status}
                  </AdminStatus>
                  {' · '}
                  {selected.author}
                  {' · '}
                  {selected.date}
                  {selected.fish && (
                    <>
                      <br />
                      Улов: {selected.fish}
                      {selected.weight ? ` · ${selected.weight}` : ''}
                    </>
                  )}
                </p>

                {editing && editForm ? (
                  <div className="admin-edit-form">
                    <label>
                      Место
                      <input
                        value={editForm.place}
                        onChange={(e) => setEditForm({ ...editForm, place: e.target.value })}
                      />
                    </label>
                    <label>
                      Дата
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      />
                    </label>
                    <label>
                      Улов
                      <input
                        value={editForm.fish}
                        onChange={(e) => setEditForm({ ...editForm, fish: e.target.value })}
                      />
                    </label>
                    <label>
                      Наживка
                      <input
                        value={editForm.bait}
                        onChange={(e) => setEditForm({ ...editForm, bait: e.target.value })}
                      />
                    </label>
                    <label>
                      Вес
                      <input
                        value={editForm.weight}
                        onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                      />
                    </label>
                    <label>
                      Описание
                      <textarea
                        rows={5}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </label>
                    <div className="admin-toolbar">
                      <button type="button" className="admin-btn admin-btn--primary" onClick={saveEdit}>
                        Сохранить
                      </button>
                      <button type="button" className="admin-btn" onClick={() => setEditing(false)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {selected.images?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        {selected.images.map((src, i) => (
                          <img
                            key={`${src}-${i}`}
                            src={src}
                            alt=""
                            style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                      </div>
                    )}

                    <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
                      <p>{selected.description}</p>
                      {selected.bait && (
                        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                          Наживка: {selected.bait}
                        </p>
                      )}
                      {selected.extra && <p style={{ fontSize: '0.9rem' }}>{selected.extra}</p>}
                    </div>
                  </>
                )}

                <div className="admin-toolbar">
                  {!editing && (
                    <button type="button" className="admin-btn" onClick={() => setEditing(true)}>
                      Редактировать
                    </button>
                  )}
                  {selected.status !== 'approved' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={() => act(selected.id, 'approve')}
                    >
                      Одобрить
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => act(selected.id, 'reject')}
                  >
                    Отклонить
                  </button>
                  <button type="button" className="admin-btn" onClick={() => act(selected.id, 'hide')}>
                    Скрыть
                  </button>
                  <Link to={`/reports/${selected.id}`} className="admin-btn" target="_blank">
                    На сайте
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <h3>Комментарии к отчётам</h3>
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
              className={`admin-btn ${commentFilter === s.id ? 'admin-btn--primary' : ''}`}
              onClick={() => setCommentFilter(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {comments.length === 0 ? (
          <div className="admin-empty">Нет комментариев</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Отчёт</th>
                  <th>Комментарий</th>
                  <th>Автор</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c) => (
                  <tr key={c.id}>
                    <td>{c.placeName || c.reportId}</td>
                    <td>{(c.text || '').slice(0, 120)}</td>
                    <td>{c.author}</td>
                    <td>
                      <AdminStatus status={c.status}>
                        {STATUS_LABELS[c.status] || c.status}
                      </AdminStatus>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <Link to={`/reports/${c.reportId}`} className="admin-btn admin-btn--sm">
                          Отчёт
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--primary"
                          onClick={() => actComment(c.id, 'approve')}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--danger"
                          onClick={() => actComment(c.id, 'reject')}
                        >
                          Отклонить
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
