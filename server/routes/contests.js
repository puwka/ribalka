import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getContest,
  listContestPrizes,
  rankMonthlyActivity,
  rankReportsContest,
  settleContest,
  settleDueContests,
} from '../services/contests.js';
import { debitBalance, creditBalance, notifyWallet } from '../services/wallet.js';

const router = Router();
router.use(authMiddleware);

function monthBounds(ym) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    y = Number(ym.slice(0, 4));
    m = Number(ym.slice(5, 7)) - 1;
  }
  const starts = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const ends = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return {
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    label: `${y}-${String(m + 1).padStart(2, '0')}`,
  };
}

function parsePrizes(body, type) {
  const raw = body?.prizes;
  const defaults =
    type === 'reports'
      ? [
          [1, body?.prize1],
          [2, body?.prize2],
          [3, body?.prize3],
          [4, body?.prize4],
        ]
      : [
          [1, body?.prize1],
          [2, body?.prize2],
          [3, body?.prize3],
        ];

  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((p) => ({
        place: Number(p.place),
        amount_rub: Number(p.amount_rub ?? p.amount),
      }))
      .filter((p) => p.place >= 1 && p.place <= 10 && p.amount_rub >= 0);
  }

  return defaults
    .map(([place, amount]) => ({
      place,
      amount_rub: Number(amount) || 0,
    }))
    .filter((p) => p.amount_rub > 0 || p.place <= (type === 'reports' ? 4 : 3));
}

/** Public: list active / recent contests + auto-settle due */
router.get('/', async (_req, res, next) => {
  try {
    await settleDueContests();
    const { rows } = await pool.query(
      `select id, type, title, description, status, starts_at, ends_at, settled_at, created_at
       from public.contests
       where status in ('active', 'settled')
       order by
         case when status = 'active' then 0 else 1 end,
         ends_at desc
       limit 40`
    );
    const withPrizes = await Promise.all(
      rows.map(async (c) => ({ ...c, prizes: await listContestPrizes(c.id) }))
    );
    res.json(withPrizes);
  } catch (err) {
    next(err);
  }
});

/** Public: fishermen ranking (reviews + comments) */
router.get('/ranking', async (req, res, next) => {
  try {
    const { startsAt, endsAt, label } = monthBounds(req.query.month);
    const limit = Math.min(50, Math.max(3, Number(req.query.limit) || 20));
    const ranking = await rankMonthlyActivity(startsAt, endsAt, limit);
    res.json({ month: label, startsAt, endsAt, ranking });
  } catch (err) {
    next(err);
  }
});

/* ——— Wallet (before /:id) ——— */

router.get('/wallet/me', requireAuth, async (req, res, next) => {
  try {
    await settleDueContests();
    const { rows: u } = await pool.query(
      `select balance_rub from public.users where id = $1`,
      [req.user.sub]
    );
    const { rows: tx } = await pool.query(
      `select * from public.wallet_transactions
       where user_id = $1 order by created_at desc limit 50`,
      [req.user.sub]
    );
    const { rows: wd } = await pool.query(
      `select id, amount_rub, card_masked, status, admin_note, created_at, reviewed_at
       from public.withdrawals
       where user_id = $1 order by created_at desc limit 30`,
      [req.user.sub]
    );
    const { rows: awards } = await pool.query(
      `select a.*, c.title as contest_title, c.type as contest_type
       from public.contest_awards a
       join public.contests c on c.id = a.contest_id
       where a.user_id = $1
       order by a.created_at desc
       limit 20`,
      [req.user.sub]
    );
    res.json({
      balance_rub: Number(u[0]?.balance_rub) || 0,
      transactions: tx,
      withdrawals: wd,
      awards,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/wallet/withdraw', requireAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount_rub ?? req.body?.amount);
    const cardDetails = String(req.body?.card_details || req.body?.card || '').trim();
    if (!(amount >= 100)) {
      return res.status(400).json({ error: 'Минимальная сумма вывода — 100 ₽' });
    }
    if (cardDetails.length < 8) {
      return res.status(400).json({ error: 'Укажите реквизиты карты (номер и ФИО получателя)' });
    }
    const digits = cardDetails.replace(/\D/g, '');
    const cardMasked =
      digits.length >= 4 ? `•••• ${digits.slice(-4)}` : cardDetails.slice(0, 12);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows: wdRows } = await client.query(
        `insert into public.withdrawals
           (user_id, amount_rub, card_masked, card_details, status)
         values ($1,$2,$3,$4,'pending')
         returning *`,
        [req.user.sub, amount, cardMasked, cardDetails]
      );
      const wd = wdRows[0];
      await debitBalance(client, {
        userId: req.user.sub,
        amountRub: amount,
        kind: 'withdraw_hold',
        title: 'Заявка на вывод',
        withdrawalId: wd.id,
      });
      await notifyWallet(
        client,
        req.user.sub,
        'Заявка на вывод',
        `Заявка на ${amount.toLocaleString('ru-RU')} ₽ отправлена на модерацию.`,
        '/cabinet/balance'
      );
      await client.query('commit');
      res.status(201).json(wd);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/wallet/withdrawals', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const { rows } = await pool.query(
      `select w.*, p.display_name, u.email
       from public.withdrawals w
       join public.users u on u.id = w.user_id
       left join public.profiles p on p.user_id = w.user_id
       where ($1::text = 'all' or w.status = $1)
       order by w.created_at desc
       limit 100`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/wallet/withdrawals/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const decision = req.body?.status === 'rejected' ? 'rejected' : 'paid';
    const note = String(req.body?.admin_note || req.body?.note || '').trim();

    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `select * from public.withdrawals where id = $1 for update`,
        [req.params.id]
      );
      const wd = rows[0];
      if (!wd) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Not found' });
      }
      if (wd.status !== 'pending') {
        await client.query('rollback');
        return res.status(400).json({ error: 'Заявка уже обработана' });
      }

      await client.query(
        `update public.withdrawals
         set status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = now()
         where id = $1`,
        [wd.id, decision, note, req.user.sub]
      );

      if (decision === 'paid') {
        await client.query(
          `insert into public.wallet_transactions
             (user_id, amount_rub, kind, status, withdrawal_id, title, meta)
           values ($1,0,'withdraw_paid','posted',$2,'Вывод подтверждён','{}'::jsonb)`,
          [wd.user_id, wd.id]
        );
        await notifyWallet(
          client,
          wd.user_id,
          'Вывод выполнен',
          `Мы перевели ${Number(wd.amount_rub).toLocaleString('ru-RU')} ₽ на карту ${wd.card_masked}.`,
          '/cabinet/balance'
        );
      } else {
        await creditBalance(client, {
          userId: wd.user_id,
          amountRub: wd.amount_rub,
          kind: 'withdraw_refund',
          title: 'Возврат: вывод отклонён',
          withdrawalId: wd.id,
          meta: { note },
        });
        await notifyWallet(
          client,
          wd.user_id,
          'Вывод отклонён',
          note || 'Заявка на вывод отклонена, сумма возвращена на баланс.',
          '/cabinet/balance'
        );
      }

      await client.query('commit');
      const { rows: out } = await pool.query(`select * from public.withdrawals where id = $1`, [
        wd.id,
      ]);
      res.json(out[0]);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/** Admin: all contests (before /:id) */
router.get('/admin/all', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    await settleDueContests();
    const { rows } = await pool.query(
      `select * from public.contests order by created_at desc limit 100`
    );
    const list = await Promise.all(
      rows.map(async (c) => {
        const full = await getContest(c.id);
        return full;
      })
    );
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/** Admin: create contest */
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const type = req.body?.type === 'monthly_activity' ? 'monthly_activity' : 'reports';
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Укажите название' });

    let startsAt = req.body?.starts_at || req.body?.startsAt;
    let endsAt = req.body?.ends_at || req.body?.endsAt;

    if (type === 'monthly_activity' && req.body?.month) {
      const b = monthBounds(String(req.body.month));
      startsAt = b.startsAt;
      endsAt = b.endsAt;
    }

    if (!startsAt || !endsAt) {
      return res.status(400).json({ error: 'Укажите период starts_at / ends_at' });
    }

    const prizes = parsePrizes(req.body, type);
    if (!prizes.some((p) => p.amount_rub > 0)) {
      return res.status(400).json({ error: 'Укажите суммы призов' });
    }

    const status = req.body?.status === 'draft' ? 'draft' : 'active';
    const description = String(req.body?.description || '').trim();

    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `insert into public.contests
           (type, title, description, status, starts_at, ends_at, created_by)
         values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,
        [type, title, description, status, startsAt, endsAt, req.user.sub]
      );
      const contest = rows[0];
      for (const p of prizes) {
        await client.query(
          `insert into public.contest_prizes (contest_id, place, amount_rub)
           values ($1,$2,$3)`,
          [contest.id, p.place, p.amount_rub]
        );
      }
      await client.query('commit');
      res.status(201).json(await getContest(contest.id));
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/:id/standings', async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Not found' });
    const maxPlace = Math.max(4, ...(contest.prizes || []).map((p) => Number(p.place)), 4);
    let standings = [];
    if (contest.type === 'reports') {
      standings = await rankReportsContest(contest.starts_at, contest.ends_at, maxPlace);
    } else {
      standings = await rankMonthlyActivity(contest.starts_at, contest.ends_at, maxPlace);
    }
    res.json({ contest, standings });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Not found' });
    res.json(contest);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['draft', 'active', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус' });
    }
    const { rows } = await pool.query(
      `update public.contests set status = $2
       where id = $1 and status <> 'settled'
       returning *`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(await getContest(rows[0].id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/settle', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const contest = await settleContest(req.params.id, { force });
    res.json(contest);
  } catch (err) {
    next(err);
  }
});

export default router;
