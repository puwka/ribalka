import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GuestOnly } from '../components/auth/RequireAuth';
import { authService } from '../services/authService';
import '../components/auth/AuthShared.css';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetPath, setDevResetPath] = useState('');
  const [mailMissing, setMailMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setDevResetPath('');
    setMailMissing(false);
    try {
      const result = await authService.requestPasswordReset(email);
      setSuccess(
        result?.message ||
          'Если аккаунт с таким email есть, мы отправили ссылку для восстановления пароля.'
      );
      if (result && result.mailConfigured === false) {
        setMailMissing(true);
      }
      if (result?.devResetUrl) {
        try {
          const u = new URL(result.devResetUrl, window.location.origin);
          setDevResetPath(`${u.pathname}${u.search}`);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(err.message || 'Не удалось отправить письмо');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Восстановление пароля</h1>
        <p className="auth-card__subtitle">
          Укажите email аккаунта — пришлём ссылку для нового пароля
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          {mailMissing && (
            <div className="auth-error">
              На сервере не настроен Resend (`RESEND_API_KEY`). Письмо не отправлено —
              добавьте ключ в `.env` на VPS и перезапустите API.
            </div>
          )}
          {devResetPath && (
            <div className="auth-success">
              Письмо не настроено (dev).{' '}
              <Link to={devResetPath}>Открыть ссылку сброса</Link>
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Отправка…' : 'Отправить ссылку'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Вернуться ко входу</Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <GuestOnly>
      <ForgotPasswordForm />
    </GuestOnly>
  );
}
