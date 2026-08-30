import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { bookingService } from '../../services/bookingService';
import './BookingForm.css';

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function plusDays(key, n) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function BookingForm({ base, onSuccess }) {
  const { user, profile, isAuthenticated } = useAuth();
  const services = useMemo(() => bookingService.servicesFromBase(base), [base]);
  const [checkIn, setCheckIn] = useState(tomorrowKey());
  const [checkOut, setCheckOut] = useState(plusDays(tomorrowKey(), 2));
  const [service, setService] = useState(services[0] || '');
  const [guests, setGuests] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    setContactName(profile?.display_name || '');
    setContactPhone(profile?.phone || '');
  }, [profile]);

  useEffect(() => {
    if (!services.includes(service)) setService(services[0] || '');
  }, [services, service]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!base?.id || !checkIn || !checkOut || checkOut <= checkIn) {
        setAvailability(null);
        return;
      }
      setChecking(true);
      try {
        const res = await bookingService.checkAvailability(base.id, checkIn, checkOut);
        if (alive) setAvailability(res);
      } catch (err) {
        if (alive) setAvailability({ ok: false, reason: err.message });
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [base?.id, checkIn, checkOut]);

  if (!base || base.type === 'free') return null;

  if (!isAuthenticated) {
    return (
      <div className="booking-form booking-form--gate">
        <h3>Бронирование</h3>
        <p>Войдите, чтобы отправить заявку на бронь.</p>
        <Link className="booking-form__submit" to="/login">
          Войти
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="booking-form booking-form--done">
        <h3>Заявка отправлена</h3>
        <p>
          Статус: <strong>pending</strong>. Владелец базы подтвердит или отклонит бронь.
        </p>
        <p className="booking-form__meta">
          {done.base_name} · {done.check_in} → {done.check_out} · {done.service}
        </p>
        <Link className="booking-form__submit" to="/cabinet/bookings">
          Мои бронирования
        </Link>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const booking = await bookingService.create({
        userId: user.id,
        baseId: base.id,
        checkIn,
        checkOut,
        service,
        guestsCount: guests,
        contactName,
        contactPhone,
        notes,
      });
      setDone(booking);
      onSuccess?.(booking);
    } catch (err) {
      setError(err.message || 'Не удалось отправить бронь');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="booking-form" onSubmit={onSubmit}>
      <h3>Забронировать</h3>
      <p className="booking-form__lead">
        Выберите даты, период и услугу — заявка уйдёт владельцу базы.
      </p>

      <div className="booking-form__row">
        <label>
          Заезд
          <input
            type="date"
            required
            value={checkIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              const v = e.target.value;
              setCheckIn(v);
              if (checkOut <= v) setCheckOut(plusDays(v, 1));
            }}
          />
        </label>
        <label>
          Выезд
          <input
            type="date"
            required
            value={checkOut}
            min={plusDays(checkIn, 1)}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
      </div>

      <label>
        Услуга
        <select required value={service} onChange={(e) => setService(e.target.value)}>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        Гостей
        <input
          type="number"
          min={1}
          max={20}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value) || 1)}
        />
      </label>

      <div className="booking-form__row">
        <label>
          Имя
          <input
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Как к вам обращаться"
          />
        </label>
        <label>
          Телефон
          <input
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+7…"
          />
        </label>
      </div>

      <label>
        Комментарий
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Пожелания по размещению, время заезда…"
        />
      </label>

      <div
        className={`booking-form__avail ${
          availability?.ok ? 'is-ok' : availability ? 'is-bad' : ''
        }`}
      >
        {checking && 'Проверяем доступность…'}
        {!checking && availability?.ok && 'Даты свободны'}
        {!checking && availability && !availability.ok && (availability.reason || 'Недоступно')}
      </div>

      {error && <div className="booking-form__error">{error}</div>}

      <button
        type="submit"
        className="booking-form__submit"
        disabled={submitting || checking || availability?.ok === false}
      >
        {submitting ? 'Отправка…' : 'Отправить бронь'}
      </button>
    </form>
  );
}
