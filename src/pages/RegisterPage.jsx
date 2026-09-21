import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { GuestOnly } from '../components/auth/RequireAuth';
import '../components/auth/AuthShared.css';

function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '';
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(form.email, form.password, form.displayName, 'user');
      navigate(from && !String(from).startsWith('/owner') ? from : '/cabinet', { replace: true });
    } catch (err) {
      setError(err.message || 'Не удалось зарегистрироваться');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Регистрация</h1>
        <p className="auth-card__subtitle">Создайте аккаунт пользователя на сайте</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Имя
            <input
              required
              value={form.displayName}
              onChange={onChange('displayName')}
              placeholder="Как к вам обращаться"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={onChange('email')}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={form.password}
              onChange={onChange('password')}
            />
          </label>
          <label>
            Тип аккаунта
            <select value="user" disabled aria-readonly="true">
              <option value="user">Пользователь</option>
            </select>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Создание…' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="auth-links">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}
