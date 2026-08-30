import { bookingsDb, BOOKING_STATUS } from '../lib/bookingsDb';
import { basesService } from './basesService';
import { gamificationService } from './gamificationService';
import { notificationService } from './notificationService';
import { ApiError } from '../lib/apiError';

function eachDate(checkIn, checkOut) {
  const out = [];
  const cur = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function overlaps(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000));
}

export const bookingService = {
  statuses: BOOKING_STATUS,

  async create({
    userId,
    baseId,
    checkIn,
    checkOut,
    service,
    guestsCount = 1,
    contactName,
    contactPhone,
    notes = '',
  }) {
    if (!userId) throw new ApiError('Войдите, чтобы забронировать');
    if (!baseId || !checkIn || !checkOut) throw new ApiError('Укажите базу и даты');
    if (checkOut <= checkIn) throw new ApiError('Дата выезда должна быть позже заезда');
    if (!contactName?.trim() || !contactPhone?.trim()) {
      throw new ApiError('Укажите контактные имя и телефон');
    }
    if (!service?.trim()) throw new ApiError('Выберите услугу');

    const publicList = await basesService.listPublic({ type: 'paid' });
    const live = publicList.find((b) => String(b.id) === String(baseId));
    if (!live || live.status !== 'approved') {
      throw new ApiError('База недоступна для бронирования');
    }
    if (live.type === 'free') {
      throw new ApiError('Бесплатные места не бронируются');
    }

    const ownerId = live.ownerId || live.owner_id;
    if (!ownerId) throw new ApiError('У базы не указан владелец');

    const available = await this.checkAvailability(baseId, checkIn, checkOut);
    if (!available.ok) {
      throw new ApiError(available.reason || 'Выбранные даты недоступны');
    }

    const nights = nightsBetween(checkIn, checkOut);
    const priceFrom = Number(live.price_from) || 0;
    const total = priceFrom > 0 ? priceFrom * nights * Math.max(1, guestsCount) : null;

    const booking = {
      id: crypto.randomUUID(),
      base_id: String(baseId),
      base_name: live.name,
      owner_id: ownerId,
      user_id: userId,
      status: BOOKING_STATUS.PENDING,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      service: service.trim(),
      guests_count: Math.max(1, Number(guestsCount) || 1),
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      notes: notes.trim(),
      total_amount: total,
      currency: 'RUB',
      price_label: live.price || live.price_label || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      decided_at: null,
      decision_note: null,
    };

    await bookingsDb.add(booking);
    try {
      notificationService.notifyOwner(
        ownerId,
        'Новая бронь',
        `${contactName.trim()} · ${live.name} · ${checkIn}–${checkOut}`,
        '/owner/bookings'
      );
      notificationService.notifyBooking(
        userId,
        'Заявка отправлена',
        `Бронь на «${live.name}» ожидает подтверждения владельца`,
        '/cabinet/bookings'
      );
      await gamificationService.recompute(userId);
    } catch {
      // optional side-effects
    }
    return booking;
  },

  async checkAvailability(baseId, checkIn, checkOut) {
    const dates = eachDate(checkIn, checkOut);
    for (const date of dates) {
      const block = await bookingsDb.getAvailability(baseId, date);
      if (block?.blocked) {
        return { ok: false, reason: `Дата ${date} закрыта владельцем` };
      }
      if (block?.capacity != null && block.booked_count >= block.capacity) {
        return { ok: false, reason: `На ${date} нет свободных мест` };
      }
    }

    const existing = await bookingsDb.listByBase(baseId);
    const active = existing.filter((b) =>
      [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(b.status)
    );
    for (const b of active) {
      if (overlaps(checkIn, checkOut, b.check_in, b.check_out)) {
        return {
          ok: false,
          reason: `Пересечение с бронью ${b.check_in}–${b.check_out} (${b.status})`,
        };
      }
    }
    return { ok: true };
  },

  async listMine(userId) {
    const rows = await bookingsDb.listByUser(userId);
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listForOwner(ownerId) {
    const rows = await bookingsDb.listByOwner(ownerId);
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async get(id, { userId, ownerId, isAdmin } = {}) {
    const row = await bookingsDb.get(id);
    if (!row) throw new ApiError('Бронь не найдена');
    if (
      !isAdmin &&
      row.user_id !== userId &&
      row.owner_id !== ownerId
    ) {
      throw new ApiError('Нет доступа к брони', { status: 403 });
    }
    return row;
  },

  async confirm(ownerId, bookingId, note = '') {
    const row = await this.get(bookingId, { ownerId });
    if (row.owner_id !== ownerId) throw new ApiError('Нет доступа', { status: 403 });
    if (row.status !== BOOKING_STATUS.PENDING) {
      throw new ApiError('Подтвердить можно только заявку pending');
    }
    // re-check conflicts excluding self
    const others = (await bookingsDb.listByBase(row.base_id)).filter(
      (b) => b.id !== row.id && [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(b.status)
    );
    for (const b of others) {
      if (overlaps(row.check_in, row.check_out, b.check_in, b.check_out) && b.status === BOOKING_STATUS.CONFIRMED) {
        throw new ApiError('Конфликт с уже подтверждённой бронью');
      }
    }
    row.status = BOOKING_STATUS.CONFIRMED;
    row.decided_at = new Date().toISOString();
    row.decision_note = note || 'Подтверждено владельцем';
    row.updated_at = new Date().toISOString();
    await bookingsDb.put(row);
    await this._bumpAvailability(row, 1);
    try {
      notificationService.notifyBooking(
        row.user_id,
        'Бронь подтверждена',
        `«${row.base_name}» · ${row.check_in}–${row.check_out}`,
        '/cabinet/bookings'
      );
    } catch {
      /* ignore */
    }
    return row;
  },

  async reject(ownerId, bookingId, note = '') {
    const row = await this.get(bookingId, { ownerId });
    if (row.owner_id !== ownerId) throw new ApiError('Нет доступа', { status: 403 });
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(row.status)) {
      throw new ApiError('Нельзя отклонить эту бронь');
    }
    const wasConfirmed = row.status === BOOKING_STATUS.CONFIRMED;
    row.status = BOOKING_STATUS.CANCELLED;
    row.decided_at = new Date().toISOString();
    row.decision_note = note || 'Отклонено владельцем';
    row.updated_at = new Date().toISOString();
    await bookingsDb.put(row);
    if (wasConfirmed) await this._bumpAvailability(row, -1);
    try {
      notificationService.notifyBooking(
        row.user_id,
        'Бронь отклонена',
        `«${row.base_name}»: ${row.decision_note}`,
        '/cabinet/bookings'
      );
    } catch {
      /* ignore */
    }
    return row;
  },

  async cancelByUser(userId, bookingId) {
    const row = await this.get(bookingId, { userId });
    if (row.user_id !== userId) throw new ApiError('Нет доступа', { status: 403 });
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(row.status)) {
      throw new ApiError('Эту бронь нельзя отменить');
    }
    const wasConfirmed = row.status === BOOKING_STATUS.CONFIRMED;
    row.status = BOOKING_STATUS.CANCELLED;
    row.decided_at = new Date().toISOString();
    row.decision_note = 'Отменено гостем';
    row.updated_at = new Date().toISOString();
    await bookingsDb.put(row);
    if (wasConfirmed) await this._bumpAvailability(row, -1);
    try {
      notificationService.notifyOwner(
        row.owner_id,
        'Гость отменил бронь',
        `«${row.base_name}» · ${row.check_in}–${row.check_out}`,
        '/owner/bookings'
      );
      notificationService.notifyBooking(
        row.user_id,
        'Бронь отменена',
        `«${row.base_name}»`,
        '/cabinet/bookings'
      );
    } catch {
      /* ignore */
    }
    return row;
  },

  async complete(ownerId, bookingId) {
    const row = await this.get(bookingId, { ownerId });
    if (row.owner_id !== ownerId) throw new ApiError('Нет доступа', { status: 403 });
    if (row.status !== BOOKING_STATUS.CONFIRMED) {
      throw new ApiError('Завершить можно только confirmed');
    }
    row.status = BOOKING_STATUS.COMPLETED;
    row.updated_at = new Date().toISOString();
    await bookingsDb.put(row);
    try {
      notificationService.notifyBooking(
        row.user_id,
        'Визит завершён',
        `«${row.base_name}» — спасибо, что были с нами`,
        '/cabinet/bookings'
      );
      notificationService.notifyOwner(
        row.owner_id,
        'Бронь завершена',
        `«${row.base_name}» · ${row.check_in}–${row.check_out}`,
        '/owner/bookings'
      );
    } catch {
      /* ignore */
    }
    return row;
  },

  async setDayBlocked(ownerId, baseId, date, blocked, capacity = null) {
    const bases = await basesService.listMine(ownerId);
    const base = bases.find((b) => String(b.id) === String(baseId));
    if (!base) throw new ApiError('База не найдена или нет доступа');
    return bookingsDb.setAvailability({
      base_id: baseId,
      owner_id: ownerId,
      date,
      blocked: Boolean(blocked),
      capacity: capacity == null ? null : Number(capacity),
      booked_count: (await bookingsDb.getAvailability(baseId, date))?.booked_count || 0,
    });
  },

  async getOwnerCalendar(ownerId, baseId, year, monthIndex) {
    const bases = await basesService.listMine(ownerId);
    const base = bases.find((b) => String(b.id) === String(baseId));
    if (!base) throw new ApiError('База не найдена');

    const bookings = await bookingsDb.listByBase(baseId);
    const availability = await bookingsDb.listAvailability(baseId);
    const avMap = Object.fromEntries(availability.map((a) => [a.date, a]));

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter(
        (b) =>
          [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(b.status) &&
          b.check_in <= date &&
          date < b.check_out
      );
      const av = avMap[date];
      days.push({
        date,
        blocked: Boolean(av?.blocked),
        capacity: av?.capacity ?? null,
        booked_count: dayBookings.filter((b) => b.status === BOOKING_STATUS.CONFIRMED).length,
        pending_count: dayBookings.filter((b) => b.status === BOOKING_STATUS.PENDING).length,
        bookings: dayBookings,
      });
    }
    return { base, days };
  },

  async _bumpAvailability(booking, delta) {
    for (const date of eachDate(booking.check_in, booking.check_out)) {
      const av = (await bookingsDb.getAvailability(booking.base_id, date)) || {
        base_id: booking.base_id,
        owner_id: booking.owner_id,
        date,
        blocked: false,
        capacity: null,
        booked_count: 0,
      };
      av.booked_count = Math.max(0, (av.booked_count || 0) + delta);
      await bookingsDb.setAvailability(av);
    }
  },

  servicesFromBase(base) {
    const list = Array.isArray(base?.services)
      ? base.services.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : [];
    if (list.length) return list;
    return ['Проживание', 'Рыбалка', 'Аренда беседки'];
  },
};
