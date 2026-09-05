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

/** Preview amount for a base (settings + active order) */
router.get('/listing-checkout-preview', requireAuth, async (req, res, next) => {
  try {
    const baseId = req.query.baseId;
    if (!baseId) return res.status(400).json({ error: 'baseId required' });
    const settings = await listingOrders.getListingPriceSettings();
    const activeOrder = await listingOrders.getActiveOrderForBase(req.user.sub, baseId);
    res.json({
      settings,
      activeOrder,
      displayAmount:
        activeOrder && activeOrder.provider_payment_id
          ? Number(activeOrder.amount)
          : Number(settings.amount),
      frozen: Boolean(activeOrder?.provider_payment_id),
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

/** Owner: create order + YooKassa payment for a base */
router.post('/listing-checkout', requireAuth, async (req, res, next) => {
  try {
    const { baseId, returnUrl } = req.body || {};
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

    // Placeholder replaced after we know order id — service builds URL
    const result = await listingOrders.createListingCheckout({
      userId: req.user.sub,
      baseId,
      returnUrl: finalReturn,
    });

    // Fix return URL if placeholder used — recreate is heavy; patch return in create with order id
    res.status(201).json(result);
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

export default router;
