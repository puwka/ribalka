import { pool } from '../db.js';
import { creditBalance, notifyWallet } from './wallet.js';

export async function listContestPrizes(contestId, client = pool) {
  const { rows } = await client.query(
    `select place, amount_rub from public.contest_prizes
     where contest_id = $1 order by place`,
    [contestId]
  );
  return rows;
}

export async function getContest(id, client = pool) {
  const { rows } = await client.query(`select * from public.contests where id = $1`, [id]);
  if (!rows[0]) return null;
  const prizes = await listContestPrizes(id, client);
  const awards = await client.query(
    `select a.*, p.display_name, p.avatar_path
     from public.contest_awards a
     left join public.profiles p on p.user_id = a.user_id
     where a.contest_id = $1
     order by a.place`,
    [id]
  );
  return { ...rows[0], prizes, awards: awards.rows };
}

/**
 * Ranking for report contests: all approved reports on the site (old and new).
 * Score = likes + votes during the contest window (so fresh votes on old reports count).
 * Falls back to all-time engagement if nobody voted in the window yet.
 * One place per user (their best report).
 */
export async function rankReportsContest(startsAt, endsAt, limit = 4, client = pool) {
  const { rows } = await client.query(
    `with scored as (
       select
         r.id as report_id,
         r.user_id,
         r.place_name as report_place,
         coalesce((
           select count(*)::int from public.report_likes l
           where l.report_id = r.id
             and l.created_at >= $1::timestamptz
             and l.created_at < $2::timestamptz
         ), 0)
           + coalesce((
           select count(*)::int from public.report_votes v
           where v.report_id = r.id
             and v.created_at >= $1::timestamptz
             and v.created_at < $2::timestamptz
         ), 0) as period_score,
         coalesce((select count(*)::int from public.report_likes l where l.report_id = r.id), 0)
           + coalesce((select count(*)::int from public.report_votes v where v.report_id = r.id), 0)
           + coalesce(r.rating_score, 0) as all_time_score
       from public.fishing_reports r
       where r.status = 'approved'
         and r.user_id is not null
     ),
     ranked as (
       select
         report_id,
         user_id,
         report_place,
         case
           when exists (
             select 1 from scored s2 where s2.period_score > 0
           ) then period_score
           else all_time_score
         end as score
       from scored
     ),
     best as (
       select distinct on (user_id)
         report_id, user_id, report_place, score
       from ranked
       where score > 0
       order by user_id, score desc, report_id
     )
     select b.*, p.display_name, p.avatar_path
     from best b
     left join public.profiles p on p.user_id = b.user_id
     order by b.score desc, b.report_id
     limit $3`,
    [startsAt, endsAt, limit]
  );
  return rows;
}

/**
 * Monthly activity: approved site reviews + approved report comments.
 */
export async function rankMonthlyActivity(startsAt, endsAt, limit = 20, client = pool) {
  const { rows } = await client.query(
    `with rev as (
       select user_id, count(*)::int as reviews
       from public.site_reviews
       where status = 'approved' and user_id is not null
         and created_at >= $1::timestamptz and created_at < $2::timestamptz
       group by user_id
     ),
     com as (
       select user_id, count(*)::int as comments
       from public.report_comments
       where status = 'approved' and user_id is not null
         and created_at >= $1::timestamptz and created_at < $2::timestamptz
       group by user_id
     ),
     base_rev as (
       select user_id, count(*)::int as base_reviews
       from public.base_reviews
       where status = 'approved' and user_id is not null
         and created_at >= $1::timestamptz and created_at < $2::timestamptz
       group by user_id
     ),
     merged as (
       select
         coalesce(r.user_id, c.user_id, b.user_id) as user_id,
         coalesce(r.reviews, 0) as reviews,
         coalesce(c.comments, 0) as comments,
         coalesce(b.base_reviews, 0) as base_reviews,
         (coalesce(r.reviews, 0) + coalesce(c.comments, 0) + coalesce(b.base_reviews, 0))::numeric as score
       from rev r
       full outer join com c on c.user_id = r.user_id
       full outer join base_rev b on b.user_id = coalesce(r.user_id, c.user_id)
     )
     select m.*, p.display_name, p.avatar_path
     from merged m
     left join public.profiles p on p.user_id = m.user_id
     where m.score > 0
     order by m.score desc, m.user_id
     limit $3`,
    [startsAt, endsAt, limit]
  );
  return rows;
}

export async function settleContest(contestId, { force = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = await client.query(
      `select * from public.contests where id = $1 for update`,
      [contestId]
    );
    const contest = rows[0];
    if (!contest) throw Object.assign(new Error('Конкурс не найден'), { status: 404 });
    if (contest.status === 'settled') {
      await client.query('commit');
      return getContest(contestId);
    }
    if (contest.status === 'cancelled') {
      throw Object.assign(new Error('Конкурс отменён'), { status: 400 });
    }
    if (!force && new Date(contest.ends_at).getTime() > Date.now()) {
      throw Object.assign(new Error('Срок конкурса ещё не закончился'), { status: 400 });
    }

    const prizes = await listContestPrizes(contestId, client);
    if (!prizes.length) throw Object.assign(new Error('Не заданы призы'), { status: 400 });

    const maxPlace = Math.max(...prizes.map((p) => Number(p.place)));
    let ranking = [];
    if (contest.type === 'reports') {
      ranking = await rankReportsContest(contest.starts_at, contest.ends_at, maxPlace, client);
    } else {
      ranking = await rankMonthlyActivity(contest.starts_at, contest.ends_at, maxPlace, client);
    }

    const prizeByPlace = new Map(prizes.map((p) => [Number(p.place), Number(p.amount_rub)]));

    for (let i = 0; i < ranking.length; i += 1) {
      const place = i + 1;
      const amount = prizeByPlace.get(place);
      if (amount == null || !(amount > 0)) continue;
      const row = ranking[i];
      if (!row?.user_id) continue;

      const { rows: awardRows } = await client.query(
        `insert into public.contest_awards
           (contest_id, place, user_id, amount_rub, score, report_id, credited)
         values ($1,$2,$3,$4,$5,$6,false)
         on conflict (contest_id, place) do nothing
         returning *`,
        [
          contestId,
          place,
          row.user_id,
          amount,
          Number(row.score) || 0,
          row.report_id || null,
        ]
      );
      const award = awardRows[0];
      if (!award || award.credited) continue;

      await creditBalance(client, {
        userId: row.user_id,
        amountRub: amount,
        kind: 'prize',
        title: `Приз ${place} место: ${contest.title}`,
        contestId,
        meta: { place, contestType: contest.type },
      });

      await client.query(
        `update public.contest_awards set credited = true where id = $1`,
        [award.id]
      );

      await notifyWallet(
        client,
        row.user_id,
        'Начисление приза',
        `Вам начислено ${amount.toLocaleString('ru-RU')} ₽ за ${place} место в «${contest.title}».`,
        '/cabinet/balance'
      );
    }

    await client.query(
      `update public.contests
       set status = 'settled', settled_at = now()
       where id = $1`,
      [contestId]
    );

    await client.query('commit');
    return getContest(contestId);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Auto-settle ended active contests (safe to call often). */
export async function settleDueContests() {
  const { rows } = await pool.query(
    `select id from public.contests
     where status = 'active' and ends_at <= now()
     order by ends_at
     limit 20`
  );
  const settled = [];
  for (const r of rows) {
    try {
      settled.push(await settleContest(r.id));
    } catch (err) {
      console.error('[contests] settle failed', r.id, err.message);
    }
  }
  return settled;
}
