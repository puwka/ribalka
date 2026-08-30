import { useEffect, useState } from 'react';
import { auditService } from '../../../services/auditService';
import { AdminPageHead, AdminLoading } from '../AdminUI';

export default function AdminAuditSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setItems(await auditService.list(null, 100));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="История изменений" subtitle="Audit log важных действий" />
      <section className="admin-panel">
        {items.length === 0 ? (
          <div className="admin-empty">Записей пока нет</div>
        ) : (
          <div className="admin-feed">
            {items.map((item) => (
              <div key={item.id} className="admin-feed__item">
                <div>
                  <div className="admin-feed__title">{item.summary}</div>
                  <div className="admin-feed__meta">
                    {item.admin_name || item.admin_id} · {item.entity} · {item.action}
                  </div>
                </div>
                <div className="admin-feed__date">
                  {new Date(item.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
