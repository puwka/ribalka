import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { directoryAdminService } from '../services/directoryAdminService';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';
import DirectoryCard from '../components/directory/DirectoryCard';
import DirectoryPricingForm from '../components/directory/DirectoryPricingForm';
import './DirectoryPage.css';

const PREVIEW_LIMIT = 4;

export default function DirectoryPage() {
  const [title, setTitle] = useState('Справочник рыболова');
  const [description, setDescription] = useState(
    'Магазины, сервисы, гиды и егеря Пермского края'
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const page = await directoryAdminService.getPage();
        const list = await directoryAdminService.listPublic();
        if (!alive) return;
        setTitle(page.title || 'Справочник рыболова');
        setDescription(page.description || '');
        setItems(list);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const byCategory = useMemo(() => {
    const map = { shop: [], service: [], guide: [] };
    for (const item of items) {
      if (map[item.category]) map[item.category].push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h1>{title.startsWith('📚') ? title : `📚 ${title}`}</h1>
        <p>{description}</p>
      </div>

      <div className="directory-container">
        {loading ? (
          <div className="no-results">
            <p>Загрузка…</p>
          </div>
        ) : (
          DIRECTORY_CATEGORIES.map((cat) => {
            const list = byCategory[cat.id] || [];
            const preview = list.slice(0, PREVIEW_LIMIT);
            return (
              <section key={cat.id} className="directory-section">
                <div className="directory-section__head">
                  <h2>
                    {cat.emoji} {cat.label}
                  </h2>
                  <Link to={`/directory/${cat.tab}`} className="btn btn--ghost">
                    Смотреть все
                  </Link>
                </div>
                {preview.length === 0 ? (
                  <div className="no-results">
                    <p>Пока нет записей</p>
                  </div>
                ) : (
                  <div className="directory-grid">
                    {preview.map((item) => (
                      <DirectoryCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
                {list.length > PREVIEW_LIMIT && (
                  <div className="directory-section__more">
                    <Link to={`/directory/${cat.tab}`} className="btn btn--primary">
                      Все {cat.label.toLowerCase()} ({list.length}) →
                    </Link>
                  </div>
                )}
              </section>
            );
          })
        )}

        <DirectoryPricingForm />
      </div>
    </div>
  );
}
