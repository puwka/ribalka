import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap, resolveMediaUrl } from '../lib/apiError';
import { mapReportToUi } from '../lib/mappers';

const REPORT_SELECT = `
  *,
  report_images ( id, storage_path, external_url, provider, sort_order ),
  report_videos ( id, storage_path, external_url, provider, sort_order )
`;

async function loadComments(reportIds) {
  if (!reportIds.length) return {};
  const rows = unwrap(
    await supabase
      .from('comments')
      .select('*')
      .eq('target_type', 'report')
      .in('target_id', reportIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
  );

  /** @type {Record<string, object[]>} */
  const byTarget = {};
  for (const row of rows ?? []) {
    (byTarget[row.target_id] ??= []).push(row);
  }
  return byTarget;
}

function enrichReport(row, comments = [], votedBy = []) {
  const images = (row.report_images ?? []).map((img) => ({
    ...img,
    public_url: resolveMediaUrl(supabase, 'report-images', img.storage_path, img.external_url),
  }));
  const videos = (row.report_videos ?? []).map((vid) => ({
    ...vid,
    public_url: resolveMediaUrl(supabase, 'report-videos', vid.storage_path, vid.external_url),
  }));
  return mapReportToUi(row, { images, videos, comments, votedBy });
}

export const reportsService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  async list() {
    if (!this.isEnabled()) return null;

    const rows = unwrap(
      await supabase
        .from('fishing_reports')
        .select(REPORT_SELECT)
        .eq('status', 'approved')
        .order('trip_date', { ascending: false })
    );

    const ids = (rows ?? []).map((r) => r.id);
    const commentsMap = await loadComments(ids);

    const { data: { user } } = await supabase.auth.getUser();
    let myVotes = new Set();
    if (user && ids.length) {
      const votes = unwrap(
        await supabase
          .from('report_votes')
          .select('report_id')
          .eq('user_id', user.id)
          .in('report_id', ids)
      );
      myVotes = new Set((votes ?? []).map((v) => v.report_id));
    }

    return (rows ?? []).map((row) =>
      enrichReport(
        row,
        commentsMap[row.id] ?? [],
        myVotes.has(row.id) ? [user.id] : []
      )
    );
  },

  /**
   * @param {object} payload UI-shaped report from ReportsPage
   */
  async create(payload) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    const report = unwrap(
      await supabase
        .from('fishing_reports')
        .insert({
          user_id: user.id,
          author_name: payload.author,
          place_name: payload.place,
          trip_date: payload.date,
          fish_caught: payload.fish,
          bait: payload.bait,
          weight_label: payload.weight,
          description: payload.description,
          status: 'approved',
        })
        .select('*')
        .single()
    );

    const imageRows = (payload.images ?? []).map((url, i) => ({
      report_id: report.id,
      external_url: url.startsWith('data:') ? null : url,
      storage_path: null,
      provider: url.includes('youtube') ? 'youtube' : 'external',
      sort_order: i,
    })).filter((r) => r.external_url);

    // data: URLs should be uploaded via mediaService in a later step
    if (imageRows.length) {
      unwrap(await supabase.from('report_images').insert(imageRows));
    }

    const videoRows = (payload.videos ?? []).map((url, i) => ({
      report_id: report.id,
      external_url: url,
      provider: 'youtube',
      sort_order: i,
    }));
    if (videoRows.length) {
      unwrap(await supabase.from('report_videos').insert(videoRows));
    }

    return enrichReport(report, [], []);
  },

  async vote(reportId) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    unwrap(
      await supabase.from('report_votes').insert({
        report_id: reportId,
        user_id: user.id,
      })
    );
    return { success: true };
  },

  async addComment(reportId, { author, text, parentId }) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    return unwrap(
      await supabase
        .from('comments')
        .insert({
          target_type: 'report',
          target_id: reportId,
          user_id: user.id,
          author_name: author,
          body: text,
          parent_id: parentId || null,
        })
        .select('*')
        .single()
    );
  },
};
