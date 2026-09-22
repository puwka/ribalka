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
    role: 'user',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const role = form.role === 'owner' ? 'owner' : 'user';
      await register(form.email, form.password, form.displayName, role);
      if (role === 'owner') {
        navigate('/owner', { replace: true });
      } else {
        navigate(from && !String(from).startsWith('/owner') ? from : '/cabinet', { replace: true });
      }
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
        <p className="auth-card__subtitle">Создайте аккаунт на сайте</p>

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

          <fieldset className="auth-role">
            <legend>Тип аккаунта</legend>
            <div className="auth-role__options" role="radiogroup" aria-label="Тип аккаунта">
              <label className={`auth-role__option${form.role === 'user' ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="accountRole"
                  value="user"
                  checked={form.role === 'user'}
                  onChange={onChange('role')}
                />
                <span className="auth-role__title">Пользователь</span>
                <span className="auth-role__hint">Отчёты, избранное, комментарии</span>
              </label>
              <label className={`auth-role__option${form.role === 'owner' ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="accountRole"
                  value="owner"
                  checked={form.role === 'owner'}
                  onChange={onChange('role')}
                />
                <span className="auth-role__title">Владелец</span>
                <span className="auth-role__hint">Базы, каталог, кабинет владельца</span>
              </label>
            </div>
          </fieldset>

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
