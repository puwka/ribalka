/**
 * Email campaign architecture (outbox pattern).
 * Ready for Resend / SMTP / Supabase Edge Function `send-email`.
 *
 * Campaigns:
 * - weeklyDigest  — еженедельный дайджест
 * - newBases      — новые базы
 * - biteForecast  — прогноз клёва
 * - news          — новости
 */

export const EMAIL_CAMPAIGNS = {
  weeklyDigest: {
    id: 'weeklyDigest',
    name: 'Еженедельный дайджест',
    description: 'Сводка отчётов, тем форума и событий за неделю',
    defaultSubject: 'Рыбалка в Прикамье — дайджест недели',
  },
  newBases: {
    id: 'newBases',
    name: 'Новые базы',
    description: 'Письмо, когда одобрена новая платная база',
    defaultSubject: 'Новая база на карте Прикамья',
  },
  biteForecast: {
    id: 'biteForecast',
    name: 'Прогноз клёва',
    description: 'Лунный прогноз и лучшие окна ловли',
    defaultSubject: 'Прогноз клёва на ближайшие дни',
  },
  news: {
    id: 'news',
    name: 'Новости',
    description: 'Редакционные новости портала',
    defaultSubject: 'Новости рыбалки в Прикамье',
  },
};

const STORAGE_KEY = 'rybalka_email_outbox_v1';

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 500)));
}

/**
 * Local outbox. Production: insert into `email_outbox` table / call Edge Function.
 */
export const emailOutbox = {
  campaigns: EMAIL_CAMPAIGNS,

  enqueue({ userId, campaign, payload = {}, createdAt = new Date().toISOString() }) {
    if (!EMAIL_CAMPAIGNS[campaign]) {
      return null;
    }
    const job = {
      id: crypto.randomUUID(),
      userId,
      campaign,
      payload,
      status: 'queued',
      attempts: 0,
      createdAt,
      provider: null,
      lastError: null,
    };
    const q = readQueue();
    q.unshift(job);
    writeQueue(q);
    return job;
  },

  list({ status } = {}) {
    const q = readQueue();
    if (!status) return q;
    return q.filter((j) => j.status === status);
  },

  /**
   * Stub sender — marks jobs sent. Replace with fetch to Edge Function:
   * POST /functions/v1/send-email { jobId }
   */
  async flush(sendFn) {
    const q = readQueue();
    const next = [];
    const results = [];
    for (const job of q) {
      if (job.status !== 'queued') {
        next.push(job);
        continue;
      }
      try {
        if (typeof sendFn === 'function') {
          await sendFn(job);
        }
        results.push({ ...job, status: 'sent', sentAt: new Date().toISOString() });
        next.push({ ...job, status: 'sent', sentAt: new Date().toISOString(), attempts: job.attempts + 1 });
      } catch (err) {
        next.push({
          ...job,
          status: 'failed',
          attempts: job.attempts + 1,
          lastError: err.message || String(err),
        });
      }
    }
    writeQueue(next);
    return results;
  },

  clear() {
    writeQueue([]);
  },
};
