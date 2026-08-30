import { useCallback, useEffect, useState } from 'react';
import { reportSocialService } from '../services/reportSocialService';

const ANON_KEY = 'fishing_user_id';

export function getAnonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function useReports({ userId = null } = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date');
  const anonId = getAnonId();
  const viewerKey = userId || `anon:${anonId}`;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await reportSocialService.list({
        status: 'approved',
        sortBy,
        viewerKey,
      });
      setReports(list);
    } finally {
      setLoading(false);
    }
  }, [sortBy, viewerKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addReport = async (payload) => {
    const created = await reportSocialService.create({
      ...payload,
      authorUserId: payload.authorUserId || userId || null,
    });
    return created;
  };

  const voteReport = async (id) => {
    const result = await reportSocialService.like(id, { userId, anonId });
    await reload();
    return result;
  };

  const hasVoted = (reportId) => {
    const r = reports.find((x) => String(x.id) === String(reportId));
    return Boolean(r?.hasLiked);
  };

  const rateStars = async (id, stars) => {
    const updated = await reportSocialService.rateStars(id, stars, { userId, anonId });
    await reload();
    return updated;
  };

  const addComment = async (reportId, comment) => {
    const result = await reportSocialService.addComment(reportId, {
      ...comment,
      authorUserId: comment.authorUserId || userId || null,
    });
    await reload();
    return result.comment;
  };

  const getSortedReports = () => reports;

  return {
    reports,
    loading,
    sortBy,
    setSortBy,
    addReport,
    voteReport,
    hasVoted,
    rateStars,
    addComment,
    getSortedReports,
    reload,
    viewerKey,
    anonId,
  };
}
