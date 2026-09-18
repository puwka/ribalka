import { Router } from 'express';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';
import * as ads from '../services/ads.js';

const router = Router();

router.use(authMiddleware);

/** Public: active sidebar banners for page rails */
router.get('/sidebar/public', async (req, res, next) => {
  try {
    const surface = req.query.surface || 'news';
    const items = await ads.listActiveSidebarAds(surface);
    const left = items.filter((a) => a.placement === 'left').slice(0, 2);
    const right = items.filter((a) => a.placement === 'right').slice(0, 2);
    res.json({
      surface,
      left,
      right,
      price: await ads.getSidebarAdPrice(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sidebar/slots', async (_req, res, next) => {
  try {
    res.json(await ads.getSlotAvailability());
  } catch (err) {
    next(err);
  }
});

router.get('/sidebar/price', async (_req, res, next) => {
  try {
    res.json(await ads.getSidebarAdPrice());
  } catch (err) {
    next(err);
  }
});

router.put('/sidebar/price', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json(await ads.saveSidebarAdPrice(req.user.sub, req.body || {}));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/impression', async (req, res, next) => {
  try {
    const row = await ads.recordImpression(req.params.id);
    res.json(row || { ok: false });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/click', async (req, res, next) => {
  try {
    const row = await ads.recordClick(req.params.id);
    res.json(row || { ok: false });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await ads.listMine(req.user.sub));
  } catch (err) {
    next(err);
  }
});

router.get('/moderation', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json(await ads.listForModeration(req.query.status || 'pending'));
  } catch (err) {
    next(err);
  }
});

router.post('/sidebar', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const ad = await ads.createSidebarAd({
      userId: req.user.sub,
      title: body.title,
      targetUrl: body.target_url || body.targetUrl,
      imageUrl: body.image_url || body.imageUrl,
      placement: body.placement,
      surface: body.surface,
      days: body.days ?? body.months,
    });
    res.status(201).json(ad);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const updated = await ads.updateSidebarAd(req.user.sub, req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await ads.deleteSidebarAd(req.user.sub, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/checkout', requireAuth, async (req, res, next) => {
  try {
    const origin =
      process.env.PUBLIC_SITE_URL ||
      (typeof req.headers.origin === 'string' ? req.headers.origin : '');
    const returnUrl =
      req.body?.returnUrl ||
      (origin ? `${String(origin).replace(/\/$/, '')}/cabinet/advertising?paid=${req.params.id}` : null);
    const result = await ads.createAdCheckout({
      userId: req.user.sub,
      adId: req.params.id,
      returnUrl,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify', requireAuth, async (req, res, next) => {
  try {
    const ad = await ads.verifyAdPayment(req.params.id, {
      paymentId: req.body?.paymentId,
    });
    res.json(ad);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/moderate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const updated = await ads.moderateAd(req.user.sub, req.params.id, {
      action: req.body?.action,
      note: req.body?.note || '',
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
