/**
 * Builds payloads for email campaigns (no network).
 * Edge Function / cron should call these builders then emailOutbox.flush(sendViaProvider).
 */

import { lunarCalendarService } from '../lunarCalendarService';
import { reportSocialService } from '../reportSocialService';
import { forumService } from '../forumService';
import { basesService } from '../basesService';
import { EMAIL_CAMPAIGNS } from './emailOutbox';

function lastDays(n) {
  const since = Date.now() - n * 86400000;
  return (iso) => new Date(iso).getTime() >= since;
}

export const digestBuilder = {
  campaigns: EMAIL_CAMPAIGNS,

  async weeklyDigest(userId) {
    const recent = lastDays(7);
    const reports = (await reportSocialService.list({ status: 'approved', sortBy: 'date' })).filter((r) =>
      recent(r.createdAt || r.date)
    );
    const topics = (await forumService.listTopics({ status: 'approved' })).filter((t) =>
      recent(t.createdAt)
    );
    const today = lunarCalendarService.getDayLunarInfo(new Date());

    return {
      userId,
      template: 'weeklyDigest',
      subject: EMAIL_CAMPAIGNS.weeklyDigest.defaultSubject,
      sections: {
        lunar: {
          phase: today.moon.name,
          score: today.forecast.score,
          label: today.forecast.label,
          bestTime: today.bestTimes?.[0] || null,
        },
        reports: reports.slice(0, 5).map((r) => ({
          id: r.id,
          place: r.place,
          fish: r.fish,
          path: `/reports/${r.id}`,
        })),
        forum: topics.slice(0, 5).map((t) => ({
          id: t.id,
          title: t.title,
          path: `/forum/${t.id}`,
        })),
      },
      htmlPreview: this.renderWeeklyHtml({ reports, topics, today }),
    };
  },

  async newBasesDigest() {
    const bases = await basesService.listPublic({ type: 'paid' });
    const week = lastDays(7);
    const fresh = bases.filter((b) => week(b.reviewed_at || b.updated_at || b.created_at || 0));
    return {
      template: 'newBases',
      subject: EMAIL_CAMPAIGNS.newBases.defaultSubject,
      bases: fresh.map((b) => ({
        id: b.id,
        name: b.name,
        region: b.region || '',
        path: '/paid-waters',
      })),
    };
  },

  biteForecast(days = 3) {
    const items = [];
    const start = new Date();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const info = lunarCalendarService.getDayLunarInfo(d);
      items.push({
        date: lunarCalendarService.toDateKey(d),
        phase: info.moon.name,
        emoji: info.moon.emoji,
        score: info.forecast.score,
        label: info.forecast.label,
        best: info.bestTimes?.[0],
      });
    }
    return {
      template: 'biteForecast',
      subject: EMAIL_CAMPAIGNS.biteForecast.defaultSubject,
      days: items,
      path: '/lunar',
    };
  },

  newsBlast(articles = []) {
    return {
      template: 'news',
      subject: EMAIL_CAMPAIGNS.news.defaultSubject,
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        excerpt: a.excerpt || '',
        path: `/news/${a.id}`,
      })),
    };
  },

  renderWeeklyHtml({ reports, topics, today }) {
    const reportLis = reports
      .slice(0, 5)
      .map((r) => `<li>${r.place} — ${r.fish}</li>`)
      .join('');
    const topicLis = topics
      .slice(0, 5)
      .map((t) => `<li>${t.title}</li>`)
      .join('');
    return `
<!DOCTYPE html>
<html lang="ru"><body style="font-family:sans-serif;color:#0f172a">
  <h1>Дайджест недели</h1>
  <p>Луна: ${today.moon.emoji} ${today.moon.name}. Клёв: ${today.forecast.label} (${today.forecast.score}).</p>
  <h2>Отчёты</h2><ul>${reportLis || '<li>Пока тихо</li>'}</ul>
  <h2>Форум</h2><ul>${topicLis || '<li>Новых тем нет</li>'}</ul>
  <p><a href="/lunar">Лунный календарь</a> · <a href="/reports">Отчёты</a></p>
</body></html>`;
  },
};
