import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../components/auth/AuthContext';
import { basesService } from '../services/basesService';
import './ReportsPage.css';

const emptyForm = () => ({
  author: '',
  place: '',
  baseId: '',
  date: new Date().toISOString().split('T')[0],
  fish: '',
  bait: '',
  weight: '',
  description: '',
  extra: '',
  images: [],
  videos: [],
});

export default function ReportsPage() {
  const { user, profile, isAuthenticated, refresh } = useAuth();
  const {
    loading,
    addReport,
    voteReport,
    hasVoted,
    sortBy,
    setSortBy,
    getSortedReports,
    reload,
  } = useReports({ userId: user?.id });

  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [bases, setBases] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (profile?.display_name) {
      setFormData((f) => ({ ...f, author: f.author || profile.display_name }));
    }
  }, [profile]);

  useEffect(() => {
    basesService.listPublic({ type: 'paid' }).then(setBases).catch(() => setBases([]));
  }, []);

  const sortedReports = getSortedReports();
  const uniquePlaces = useMemo(
    () => [...new Set(sortedReports.map((r) => r.place).filter(Boolean))],
    [sortedReports]
  );

  const filteredReports = sortedReports.filter((report) => {
    const matchesFilter = filter === 'all' || report.place === filter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      report.author?.toLowerCase().includes(q) ||
      report.fish?.toLowerCase().includes(q) ||
      report.description?.toLowerCase().includes(q) ||
      report.place?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const toEmbed = (url) => {
    if (url.includes('watch?v=')) {
      const videoId = url.split('watch?v=')[1].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const base = bases.find((b) => String(b.id) === String(formData.baseId));
      const created = await addReport({
        ...formData,
        place: base?.name || formData.place,
        baseId: base?.id || null,
        baseName: base?.name || null,
        authorUserId: user?.id || null,
        author: formData.author || profile?.display_name || '',
        requireAuth: false,
      });
      await reload();
      if (user?.id) await refresh();
      setFormData(emptyForm());
      setShowForm(false);
      navigate(`/reports/${created.id}`);
    } catch (err) {
      setFormError(err.message || 'Не удалось сохранить отчёт');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (formData.images.length + files.length > 5) {
      alert('Можно загрузить максимум 5 фото');
      return;
    }
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Файл ${file.name} слишком большой (максимум 5 МБ)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, event.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVote = async (e, reportId) => {
    e.stopPropagation();
    e.preventDefault();
    const result = await voteReport(reportId);
    if (!result.success) alert(result.message);
    else if (user?.id) await refresh();
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="reports-page">
        <div className="reports-loading">Загрузка отчётов...</div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header" id="reports-top">
        <div className="reports-header__content">
          <h1>Отчёты о рыбалке</h1>
          <p>Фото, видео, улов и места — делитесь и обсуждайте</p>
          <div className="reports-stats">
            <div className="stat-item">
              <div className="stat-number">{sortedReports.length}</div>
              <div className="stat-label">Отчётов</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{uniquePlaces.length}</div>
              <div className="stat-label">Мест</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {sortedReports.reduce((sum, r) => sum + (r.rating || 0), 0)}
              </div>
              <div className="stat-label">Лайков</div>
            </div>
          </div>
        </div>
      </div>

      <div className="reports-container">
        <div className="reports-controls">
          <div className="reports-controls__left">
            <input
              type="text"
              placeholder="Поиск…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="reports-search"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="reports-filter"
            >
              <option value="all">Все места</option>
              {uniquePlaces.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="reports-sort"
            >
              <option value="date">По дате</option>
              <option value="rating">По лайкам</option>
              <option value="stars">По рейтингу</option>
              <option value="comments">По комментариям</option>
            </select>
          </div>
          <button type="button" className="add-report-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : 'Добавить отчёт'}
          </button>
        </div>

        {showForm && (
          <div className="report-form">
            <h2>Новый отчёт</h2>
            <p className="report-form__hint">
              После отправки отчёт проходит модерацию администратором.
              {!isAuthenticated && ' Войдите, чтобы привязать отчёт к профилю.'}
            </p>
            {formError && <div className="report-form__error">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Ваше имя *</label>
                  <input
                    required
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>База (если есть)</label>
                  <select
                    value={formData.baseId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const base = bases.find((b) => String(b.id) === id);
                      setFormData({
                        ...formData,
                        baseId: id,
                        place: base?.name || formData.place,
                      });
                    }}
                  >
                    <option value="">Без привязки к базе</option>
                    {bases.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Место *</label>
                  <input
                    required
                    value={formData.place}
                    onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                    placeholder="Река, озеро или база"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Улов *</label>
                  <input
                    required
                    value={formData.fish}
                    onChange={(e) => setFormData({ ...formData, fish: e.target.value })}
                    placeholder="Щука, окунь…"
                  />
                </div>
                <div className="form-group">
                  <label>Вес / количество</label>
                  <input
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="5 кг"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>На что ловили</label>
                <input
                  value={formData.bait}
                  onChange={(e) => setFormData({ ...formData, bait: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Описание *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Дополнительная информация</label>
                <textarea
                  rows={3}
                  value={formData.extra}
                  onChange={(e) => setFormData({ ...formData, extra: e.target.value })}
                  placeholder="Погода, снасти, советы…"
                />
              </div>

              <div className="form-group">
                <label>Фото (до 5)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={formData.images.length >= 5}
                />
                {formData.images.length > 0 && (
                  <div className="images-preview">
                    {formData.images.map((img, i) => (
                      <div key={i} className="image-preview-item">
                        <img src={img} alt="" />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              images: p.images.filter((_, idx) => idx !== i),
                            }))
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Видео YouTube (до 2)</label>
                <button
                  type="button"
                  className="add-video-btn"
                  disabled={formData.videos.length >= 2}
                  onClick={() => {
                    const url = window.prompt('Ссылка на YouTube:');
                    if (!url) return;
                    setFormData((p) => ({ ...p, videos: [...p.videos, toEmbed(url)] }));
                  }}
                >
                  Добавить видео
                </button>
                {formData.videos.map((v, i) => (
                  <div key={i} className="video-preview-item">
                    <iframe src={v} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ width: '100%', height: '200px', borderRadius: '12px' }}></iframe>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          videos: p.videos.filter((_, idx) => idx !== i),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Отправка…' : 'Отправить на модерацию'}
                </button>
              </div>
            </form>
          </div>
        )}

        {filteredReports.length === 0 ? (
          <div className="no-reports">
            <h3>Отчётов пока нет</h3>
            <p>Опубликуйте первый улов — после модерации он появится здесь</p>
          </div>
        ) : (
          <div className="reports-grid">
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="report-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {report.images?.[0] && (
                  <div className="report-card__image">
                    <img src={report.images[0]} alt={report.place} />
                    <div className="rating-badge">
                      ★ {report.starAvg || 0} · ♥ {report.rating || 0}
                    </div>
                  </div>
                )}
                <div className="report-card__body">
                  <div className="report-card__header">
                    <div className="author-info">
                      <div className="author-avatar">
                        {(report.author || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="author-details">
                        <div className="author-name">{report.author}</div>
                        <div className="report-date">{formatDate(report.date)}</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="report-card__title">{report.place}</h3>
                  <div className="report-card__meta">
                    <div className="meta-item">🐟 {report.fish}</div>
                    {report.weight && <div className="meta-item">⚖️ {report.weight}</div>}
                  </div>
                  <p className="report-card__description">{report.description}</p>
                  <div className="report-card__footer">
                    <button
                      type="button"
                      className={`like-btn ${hasVoted(report.id) ? 'voted' : ''}`}
                      onClick={(e) => handleVote(e, report.id)}
                    >
                      {hasVoted(report.id) ? '♥' : '♡'} {report.rating || 0}
                    </button>
                    <div className="comments-count">💬 {report.comments?.length || 0}</div>
                    <span className="details-btn">Открыть →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
