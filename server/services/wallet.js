import { pool } from '../db.js';

/**
 * Credit user balance and write ledger row (must run inside a transaction client).
 */
export async function creditBalance(client, {
  userId,
  amountRub,
  kind,
  title,
  contestId = null,
  withdrawalId = null,
  meta = {},
}) {
  const amount = Number(amountRub);
  if (!userId || !(amount > 0)) throw Object.assign(new Error('Invalid credit'), { status: 400 });

  await client.query(
    `update public.users set balance_rub = balance_rub + $2 where id = $1`,
    [userId, amount]
  );

  const { rows } = await client.query(
    `insert into public.wallet_transactions
       (user_id, amount_rub, kind, status, contest_id, withdrawal_id, title, meta)
     values ($1,$2,$3,'posted',$4,$5,$6,$7::jsonb)
     returning *`,
    [userId, amount, kind, contestId, withdrawalId, title || '', JSON.stringify(meta || {})]
  );
  return rows[0];
}

/**
 * Debit (hold) balance — amountRub positive, stored as negative in ledger.
 */
export async function debitBalance(client, {
  userId,
  amountRub,
  kind,
  title,
  contestId = null,
  withdrawalId = null,
  meta = {},
}) {
  const amount = Number(amountRub);
  if (!userId || !(amount > 0)) throw Object.assign(new Error('Invalid debit'), { status: 400 });

  const { rows: bal } = await client.query(
    `select balance_rub from public.users where id = $1 for update`,
    [userId]
  );
  if (!bal[0]) throw Object.assign(new Error('User not found'), { status: 404 });
  if (Number(bal[0].balance_rub) < amount) {
    throw Object.assign(new Error('Недостаточно средств на балансе'), { status: 400 });
  }

  await client.query(
    `update public.users set balance_rub = balance_rub - $2 where id = $1`,
    [userId, amount]
  );

  const { rows } = await client.query(
    `insert into public.wallet_transactions
       (user_id, amount_rub, kind, status, contest_id, withdrawal_id, title, meta)
     values ($1,$2,$3,'posted',$4,$5,$6,$7::jsonb)
     returning *`,
    [
      userId,
      -amount,
      kind,
      contestId,
      withdrawalId,
      title || '',
      JSON.stringify(meta || {}),
    ]
  );
  return rows[0];
}

export async function notifyWallet(client, userId, title, body, linkPath = '/cabinet/balance') {
  try {
    await client.query(
      `insert into public.notifications (user_id, type, title, body, link_path, payload)
       values ($1,'system',$2,$3,$4,'{}'::jsonb)`,
      [userId, title, body, linkPath]
    );
  } catch {
    /* non-blocking */
  }
}
