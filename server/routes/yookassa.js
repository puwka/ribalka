import { Router } from 'express';
import { handleYooKassaWebhook } from '../services/listingOrders.js';

const router = Router();

/**
 * YooKassa HTTP notifications.
 * Configure URL in YooKassa cabinet: https://your.domain/api/yookassa/webhook
 * No JWT — verified by re-fetching payment from YooKassa API.
 */
router.post('/webhook', async (req, res) => {
  try {
    const result = await handleYooKassaWebhook(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    console.error('[yookassa webhook] error', err.message);
    // Return 200 for unknown/duplicate to avoid endless retries on bad data;
    // return 500 only for transient failures so YooKassa retries.
    const status = err.status && err.status < 500 ? 200 : 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

export default router;
