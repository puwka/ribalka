import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { GuestOnly } from '../components/auth/RequireAuth';
import '../components/auth/AuthShared.css';

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from || '/cabinet';

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const bundle = await login(email, password);
      if (bundle?.isAdmin) navigate('/admin', { replace: true });
      else if (bundle?.isOwner) navigate('/owner', { replace: true });
      else navigate(from.startsWith('/owner') || from.startsWith('/admin') ? '/cabinet' : from, { replace: true });
    } catch (err) {
      setError(err.message || 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Вход</h1>
        <p className="auth-card__subtitle">Войдите в аккаунт рыболова или владельца базы</p>

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
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <div className="auth-links">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}
