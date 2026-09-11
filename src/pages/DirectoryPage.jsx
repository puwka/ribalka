import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { directoryAdminService } from '../services/directoryAdminService';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';
import DirectoryCard from '../components/directory/DirectoryCard';
import { useAuth } from '../components/auth/AuthContext';
import { directoryOwnerService } from '../services/directoryOwnerService';
import './DirectoryPage.css';

const PREVIEW_LIMIT = 4;

export default function DirectoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isOwner, isAdmin, refresh } = useAuth();
  const [title, setTitle] = useState('Справочник рыболова');
  const [description, setDescription] = useState(
    'Магазины, сервисы, гиды и егеря Пермского края'
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(DIRECTORY_CATEGORIES[0].id);
  const [opening, setOpening] = useState(false);

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

  const activeCat = DIRECTORY_CATEGORIES.find((c) => c.id === activeTab) || DIRECTORY_CATEGORIES[0];
  const list = byCategory[activeCat.id] || [];
  const preview = list.slice(0, PREVIEW_LIMIT);

  const openCabinet = async () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/owner/directory/new', preferOwner: true } });
      return;
    }
    setOpening(true);
    try {
      if (!isOwner && !isAdmin) {
        await directoryOwnerService.enableOwner();
        await refresh?.();
      }
      navigate('/owner/directory/new');
    } catch {
      navigate('/owner/directory/new');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h1>{title.startsWith('📚') ? title : `📚 ${title}`}</h1>
        <p>{description}</p>
      </div>

      <div className="directory-container">
        <div className="directory-tabs" role="tablist" aria-label="Категории справочника">
          {DIRECTORY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeTab === cat.id}
              className={`directory-tab ${activeTab === cat.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="no-results">
            <p>Загрузка…</p>
          </div>
        ) : (
          <section className="directory-section">
            <div className="directory-section__head">
              <h2>
                {activeCat.emoji} {activeCat.label}
              </h2>
              <Link to={`/directory/${activeCat.tab}`} className="btn btn--ghost">
                Смотреть все
              </Link>
            </div>
            {preview.length === 0 ? (
              <div className="no-results">
                <p>Пока нет записей</p>
              </div>
            ) : (
              <div className="directory-grid directory-grid--preview">
                {preview.map((item) => (
                  <DirectoryCard key={item.id} item={item} />
                ))}
              </div>
            )}
            <div className="directory-section__more">
              <Link to={`/directory/${activeCat.tab}`} className="btn btn--primary">
                Все {activeCat.label.toLowerCase()}
                {list.length ? ` (${list.length})` : ''} →
              </Link>
            </div>
          </section>
        )}

        <section className="directory-place-cta" id="directory-pricing">
          <h2>Разместить магазин, сервис или егеря</h2>
          <p>
            Карточка, тариф, продление и статистика (просмотры, звонки, сайт) — в личном кабинете.
            После истечения оплаты запись остаётся у вас, её можно продлить.
          </p>
          <div className="directory-place-cta__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={opening}
              onClick={openCabinet}
            >
              {opening
                ? 'Открываем кабинет…'
                : isOwner || isAdmin
                  ? 'В кабинет — добавить карточку'
                  : isAuthenticated
                    ? 'Открыть кабинет владельца'
                    : 'Зарегистрироваться и разместить'}
            </button>
            {(isOwner || isAdmin) && (
              <Link className="btn btn--ghost" to="/owner/directory">
                Мои карточки
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
