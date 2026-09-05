import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { basesService } from '../../../services/basesService';
import { reportSocialService } from '../../../services/reportSocialService';
import { forumService } from '../../../services/forumService';
import { AdminPageHead, AdminLoading, AdminStatus } from '../AdminUI';

export default function AdminModerationHub() {
  const { user } = useAuth();
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [bases, reports, forum] = await Promise.all([
          basesService.listForModeration('pending').catch(() => []),
          reportSocialService.listForModeration('pending').catch(() => []),
          forumService.listForModeration('pending').catch(() => []),
        ]);

        const items = [
          ...bases.map((b) => ({
            id: `base-${b.id}`,
            type: 'База',
            title: b.name,
            author: b.owner_id,
            status: b.status,
            at: b.submitted_at || b.updated_at,
            link: `/admin/bases?id=${encodeURIComponent(b.id)}`,
            priority: 1,
          })),
          ...reports.map((r) => ({
            id: `report-${r.id}`,
            type: 'Отчёт',
            title: r.place || 'Без места',
            author: r.author,
            status: r.status,
            at: r.createdAt || r.created_at || r.date,
            link: `/admin/reports?open=${encodeURIComponent(r.id)}`,
            priority: 2,
          })),
          ...forum.map((f) => ({
            id: `forum-${f.id}`,
            type: 'Тема',
            title: f.title || (f.body || '').slice(0, 60),
            author: f.authorName,
            status: f.status,
            at: f.createdAt || f.created_at,
            link: `/admin/forum?filter=pending`,
            priority: 3,
          })),
        ];

        items.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return String(b.at).localeCompare(String(a.at));
        });

        setQueues(items);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead
        title="Модерация"
        subtitle="Единая очередь заявок, отчётов, форума и рекламы"
      />

      <section className="admin-panel">
        {queues.length === 0 ? (
          <div className="admin-empty">Очередь пуста — всё обработано</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Объект</th>
                  <th>Автор</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {queues.map((item) => (
                  <tr key={item.id}>
                    <td>{item.type}</td>
                    <td>{item.title}</td>
                    <td>{item.author || '—'}</td>
                    <td><AdminStatus status={item.status}>{item.status}</AdminStatus></td>
                    <td>{item.at ? new Date(item.at).toLocaleDateString('ru-RU') : '—'}</td>
                    <td>
                      <Link to={item.link} className="admin-btn admin-btn--sm">
                        Открыть
                      </Link>
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
