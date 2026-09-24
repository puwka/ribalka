import { Router } from 'express';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';
import * as listingOrders from '../services/listingOrders.js';

const router = Router();

router.use(authMiddleware);

/** Public price (auth required for owners) */
router.get('/listing-price', requireAuth, async (_req, res, next) => {
  try {
    const settings = await listingOrders.getListingPriceSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

/** Preview amount for a base (settings + active order + constructor options) */
router.get('/listing-checkout-preview', requireAuth, async (req, res, next) => {
  try {
    const baseId = req.query.baseId;
    if (!baseId) return res.status(400).json({ error: 'baseId required' });
    const settings = await listingOrders.getListingPriceSettings();
    const activeOrder = await listingOrders.getActiveOrderForBase(req.user.sub, baseId);
    const options = {
      months: Number(req.query.months) || 3,
      top: false,
      frame: req.query.frame === '1' || req.query.frame === 'true',
      extraPhotos: Number(req.query.extraPhotos) || 0,
      extraVideos: Number(req.query.extraVideos) || 0,
    };
    const quote = listingOrders.quoteListingCheckout(settings, options);
    const topSlots = await listingOrders.getTopAvailability({ baseId });
    const frozen = Boolean(activeOrder?.provider_payment_id);
    res.json({
      settings,
      activeOrder,
      quote,
      topSlots: {
        ...topSlots,
        addonTopDaily: Number(settings.addonTopDaily) || 300,
      },
      displayAmount: frozen ? Number(activeOrder.amount) : quote.total,
      frozen,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/listing-top-slots', requireAuth, async (req, res, next) => {
  try {
    const settings = await listingOrders.getListingPriceSettings();
    const topSlots = await listingOrders.getTopAvailability({
      baseId: req.query.baseId || null,
    });
    res.json({
      ...topSlots,
      addonTopDaily: Number(settings.addonTopDaily) || 300,
    });
  } catch (err) {
    next(err);
  }
});

/** Admin: update price */
router.put('/listing-price', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const saved = await listingOrders.saveListingPriceSettings(req.user.sub, req.body || {});
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.get('/directory-prices', async (_req, res, next) => {
  try {
    res.json(await listingOrders.getDirectoryListingPrices());
  } catch (err) {
    next(err);
  }
});

router.get('/directory-top-slots', requireAuth, async (req, res, next) => {
  try {
    const directoryOrders = await import('../services/directoryOrders.js');
    const prices = await listingOrders.getDirectoryListingPrices();
    const tariff = prices.service || {};
    const topSlots = await directoryOrders.getDirectoryTopAvailability({
      category: req.query.category || null,
      itemId: req.query.itemId || req.query.directoryItemId || null,
    });
    res.json({
      ...topSlots,
      addonTopDaily: Number(tariff.addonTopDaily ?? tariff.addonTop) || 300,
    });
  } catch (err) {
    next(err);
  }
});

/** Public constructor tariff for base owners (read) */
router.get('/listing-price-public', async (_req, res, next) => {
  try {
    const settings = await listingOrders.getListingPriceSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/directory-prices/:kind', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const saved = await listingOrders.saveDirectoryListingPrice(
      req.user.sub,
      req.params.kind,
      req.body || {}
    );
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

/** Public: apply + pay for directory listing (shop / service / guide) */
router.post('/directory-checkout', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const origin =
      process.env.PUBLIC_SITE_URL ||
      (typeof req.headers.origin === 'string' ? req.headers.origin : '');
    const returnUrl =
      body.returnUrl ||
      (origin
        ? `${String(origin).replace(/\/$/, '')}/owner/directory/payment/result/:orderId`
        : null);
    const directoryOrders = await import('../services/directoryOrders.js');
    const result =
      body.mode === 'top_daily'
        ? await directoryOrders.createDirectoryTopDailyCheckout({
            userId: req.user.sub,
            directoryItemId: body.directoryItemId || body.directory_item_id || null,
            topDays: Number(body.topDays) || 1,
            returnUrl,
          })
        : body.mode === 'upgrade'
          ? await directoryOrders.createDirectoryUpgradeCheckout({
              userId: req.user.sub,
              directoryItemId: body.directoryItemId || body.directory_item_id || null,
              top: false,
              topDays: Number(body.topDays) || 0,
              frame: Boolean(body.frame),
              returnUrl,
            })
          : await directoryOrders.createDirectoryCheckout({
              userId: req.user.sub,
              category: body.category,
              months: body.months,
              frame: Boolean(body.frame),
              top: false,
              topDays: Number(body.topDays) || 0,
              listing: body.listing || body,
              directoryItemId: body.directoryItemId || body.directory_item_id || null,
              returnUrl,
            });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/directory-orders/mine', requireAuth, async (req, res, next) => {
  try {
    const directoryOrders = await import('../services/directoryOrders.js');
    res.json(await directoryOrders.listOrdersForUser(req.user.sub));
  } catch (err) {
    next(err);
  }
});

router.get('/directory-orders', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const directoryOrders = await import('../services/directoryOrders.js');
    res.json(await directoryOrders.listOrdersAdmin({ status: req.query.status }));
  } catch (err) {
    next(err);
  }
});

router.get('/directory-orders/:id', requireAuth, async (req, res, next) => {
  try {
    const directoryOrders = await import('../services/directoryOrders.js');
    const isAdmin = (req.user.roles || []).includes('admin');
    const order = await directoryOrders.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && order.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.post('/directory-orders/:id/verify', requireAuth, async (req, res, next) => {
  try {
    const directoryOrders = await import('../services/directoryOrders.js');
    const isAdmin = (req.user.roles || []).includes('admin');
    const result = await directoryOrders.verifyDirectoryOrderPayment(req.params.id, {
      userId: req.user.sub,
      isAdmin,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Owner: create order + YooKassa payment for a base */
router.post('/listing-checkout', requireAuth, async (req, res, next) => {
  try {
    const { baseId, returnUrl, months, top, frame, extraPhotos, extraVideos, mode } =
      req.body || {};
    if (!baseId) return res.status(400).json({ error: 'baseId required' });

    const site =
      process.env.PUBLIC_SITE_URL ||
      process.env.YOOKASSA_RETURN_URL?.replace(/\/owner\/.*/, '') ||
      '';
    const finalReturn =
      returnUrl ||
      (site
        ? `${site.replace(/\/$/, '')}/owner/payment/result/:orderId`
        : null);

    const options = {
      months,
      top: false,
      frame,
      extraPhotos,
      extraVideos,
      topDays: Number(req.body?.topDays) || 0,
    };
    let result;
    if (mode === 'top_daily') {
      result = await listingOrders.createTopDailyCheckout({
        userId: req.user.sub,
        baseId,
        returnUrl: finalReturn,
        topDays: Number(req.body?.topDays) || 1,
      });
    } else if (mode === 'upgrade') {
      result = await listingOrders.createListingUpgradeCheckout({
        userId: req.user.sub,
        baseId,
        returnUrl: finalReturn,
        options,
      });
    } else {
      result = await listingOrders.createListingCheckout({
        userId: req.user.sub,
        baseId,
        returnUrl: finalReturn,
        options,
      });
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/listing-upgrade-preview', requireAuth, async (req, res, next) => {
  try {
    const baseId = req.query.baseId;
    if (!baseId) return res.status(400).json({ error: 'baseId required' });
    const settings = await listingOrders.getListingPriceSettings();
    const { pool } = await import('../db.js');
    const { rows } = await pool.query(
      `select * from public.bases where id = $1 and owner_id = $2 limit 1`,
      [baseId, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'База не найдена' });
    const quote = listingOrders.quoteListingUpgrade(settings, rows[0], {
      months: Number(req.query.months) || 3,
      top: false,
      frame: req.query.frame === '1' || req.query.frame === 'true',
      extraPhotos: Number(req.query.extraPhotos) || 0,
      extraVideos: Number(req.query.extraVideos) || 0,
    });
    const topSlots = await listingOrders.getTopAvailability({ baseId });
    res.json({
      settings,
      quote,
      topSlots: {
        ...topSlots,
        addonTopDaily: Number(settings.addonTopDaily) || 300,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/listing-orders/mine', requireAuth, async (req, res, next) => {
  try {
    const items = await listingOrders.listOrdersForUser(req.user.sub, {
      status: req.query.status,
      baseId: req.query.baseId,
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/listing-orders', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const items = await listingOrders.listOrdersAdmin({
      status: req.query.status,
      baseId: req.query.baseId,
      userId: req.query.userId,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/listing-orders/:id', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = (req.user.roles || []).includes('admin');
    const order = await listingOrders.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && order.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

/** Return-URL verification — polls YooKassa, never trusts client */
router.post('/listing-orders/:id/verify', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = (req.user.roles || []).includes('admin');
    const result = await listingOrders.verifyOrderPayment(req.params.id, {
      userId: req.user.sub,
      isAdmin,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Public donation / project support via YooKassa redirect.
 * Body: { amount: number, email?: string, returnPath?: string }
 */
router.post('/donate', async (req, res, next) => {
  try {
    const yookassa = await import('../services/yookassa.js');
    if (!yookassa.isYooKassaConfigured()) {
      return res.status(503).json({
        error: 'Оплата временно недоступна. Попробуйте позже или напишите на почту сайта.',
      });
    }

    const amount = Math.round(Number(req.body?.amount) || 0);
    if (!Number.isFinite(amount) || amount < 10) {
      return res.status(400).json({ error: 'Минимальная сумма — 10 ₽' });
    }
    if (amount > 100_000) {
      return res.status(400).json({ error: 'Максимальная сумма — 100 000 ₽' });
    }

    const emailRaw = String(req.body?.email || '').trim().toLowerCase();
    const fallbackEmail = String(
      process.env.DONATE_RECEIPT_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || ''
    )
      .trim()
      .toLowerCase();
    const customerEmail = emailRaw.includes('@') ? emailRaw : fallbackEmail;
    if (!customerEmail) {
      return res.status(400).json({
        error: 'Укажите email для чека (нужен для оплаты через ЮKassa).',
      });
    }

    const site = String(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(
      /\/$/,
      ''
    );
    const returnPathRaw = String(req.body?.returnPath || '/support/thanks').trim();
    const returnPath =
      returnPathRaw === '/support/thanks' || returnPathRaw.startsWith('/support/')
        ? returnPathRaw
        : '/support/thanks';
    const returnUrl = `${site}${returnPath}`;
    const description = 'Поддержка проекта Рыбалка в Прикамье';

    const { payment } = await yookassa.createPayment({
      amount,
      currency: 'RUB',
      description,
      returnUrl,
      customerEmail,
      metadata: {
        kind: 'donate',
        amount: String(amount),
        userId: req.user?.sub || '',
      },
    });

    const confirmationUrl = payment?.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return res.status(502).json({ error: 'ЮKassa не вернула ссылку на оплату' });
    }

    try {
      const donations = await import('../services/donations.js');
      await donations.recordDonationPending({
        userId: req.user?.sub || null,
        email: customerEmail,
        amount,
        providerPaymentId: payment.id,
        confirmationUrl,
        meta: { kind: 'donate', returnPath },
      });
    } catch (err) {
      console.error('[donate] persist failed', err.message);
    }

    res.json({
      ok: true,
      paymentId: payment.id,
      confirmationUrl,
      amount,
    });
  } catch (err) {
    next(err);
  }
});

/** Admin: dashboard money (all paid sources) */
router.get('/admin-summary', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { getAdminMoneySummary } = await import('../services/moneySummary.js');
    res.json(await getAdminMoneySummary());
  } catch (err) {
    next(err);
  }
});

/** Admin: project support (donate) stats */
router.get('/donations', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const donations = await import('../services/donations.js');
    const data = await donations.getDonationStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
