import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../components/auth/AuthContext';
import { basesService } from '../services/basesService';
import { api, apiDataEnabled } from '../lib/apiClient';
import './ReportsPage.css';

function parseWeightKg(report) {
  if (report.weightKg != null && Number.isFinite(Number(report.weightKg))) {
    return Number(report.weightKg);
  }
  const m = String(report.weight || '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export default function ReportsAllPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { loading, getSortedReports, hasVoted, voteReport, reload } = useReports({ userId: user?.id });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [regionFilter, setRegionFilter] = useState('all');
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bases, districts] = await Promise.all([
          basesService.listPublic().catch(() => []),
          apiDataEnabled
            ? api.get('/api/cms/districts').catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const fromBases = (bases || []).map((b) => b.region).filter(Boolean);
        const fromDistricts = (districts || [])
          .map((d) => (typeof d === 'string' ? d : d?.name))
          .filter(Boolean);
        setRegions([...new Set([...fromBases, ...fromDistricts])]);
      } catch {
        if (!cancelled) setRegions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reports = getSortedReports();

  const regionOptions = useMemo(() => {
    const fromReports = reports.map((r) => r.region).filter(Boolean);
    return [...new Set([...regions, ...fromReports])].sort((a, b) =>
      String(a).localeCompare(String(b), 'ru')
    );
  }, [reports, regions]);

  const filteredReports = useMemo(() => {
    let list = [...reports];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (r) =>
          r.author?.toLowerCase().includes(q) ||
          r.fish?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.place?.toLowerCase().includes(q) ||
          r.region?.toLowerCase().includes(q)
      );
    }
    if (regionFilter !== 'all') {
      list = list.filter((r) => (r.region || '') === regionFilter);
    }
    if (sortBy === 'weight_desc') {
      list.sort((a, b) => (parseWeightKg(b) ?? -1) - (parseWeightKg(a) ?? -1));
    } else if (sortBy === 'weight_asc') {
      list.sort((a, b) => (parseWeightKg(a) ?? Infinity) - (parseWeightKg(b) ?? Infinity));
    } else if (sortBy === 'comments') {
      list.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
    } else if (sortBy === 'rating') {
      list.sort(
        (a, b) =>
          (b.rating || 0) - (a.rating || 0) ||
          (b.comments?.length || 0) - (a.comments?.length || 0)
      );
    } else {
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    return list;
  }, [reports, searchQuery, regionFilter, sortBy]);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const handleVote = async (e, reportId) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated || !user?.id) {
      navigate('/login', { state: { from: '/reports/all' } });
      return;
    }
    const result = await voteReport(reportId);
    if (!result.success) alert(result.message);
    else await reload();
  };

  if (loading) {
    return (
      <div className="reports-page">
        <div className="reports-loading">Загрузка отчётов...</div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header reports-header--compact">
        <div className="reports-header__content">
          <Link to="/reports" className="reports-back-link">
            ← К лучшим отчётам
          </Link>
          <h1>Все отчёты ({filteredReports.length})</h1>
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
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="reports-filter"
            >
              <option value="all">Все районы</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="reports-sort"
            >
              <option value="date">По дате</option>
              <option value="weight_desc">Крупнейший улов</option>
              <option value="weight_asc">Мельчайший улов</option>
              <option value="comments">По комментариям</option>
              <option value="rating">По лайкам</option>
            </select>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="no-reports">
            <h3>Ничего не найдено</h3>
            <p>Попробуйте изменить фильтры</p>
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
                  {report.region && <div className="report-card__region">{report.region}</div>}
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
