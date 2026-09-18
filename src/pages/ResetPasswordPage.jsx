import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GuestOnly } from '../components/auth/RequireAuth';
import { authService } from '../services/authService';
import '../components/auth/AuthShared.css';

function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!token) {
      setError('Ссылка недействительна. Запросите восстановление заново.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authService.resetPassword(token, password);
      setSuccess(result?.message || 'Пароль обновлён. Можно войти.');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(err.message || 'Не удалось обновить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Ссылка недействительна</h1>
          <p className="auth-card__subtitle">Запросите новую ссылку для восстановления пароля</p>
          <div className="auth-links">
            <Link to="/forgot-password">Восстановить пароль</Link>
            {' · '}
            <Link to="/login">Войти</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Новый пароль</h1>
        <p className="auth-card__subtitle">Придумайте пароль для входа в кабинет</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Новый пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Повторите пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Вернуться ко входу</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <GuestOnly>
      <ResetPasswordForm />
    </GuestOnly>
  );
}
