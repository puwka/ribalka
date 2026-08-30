import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { GuestOnly } from '../components/auth/RequireAuth';
import '../components/auth/AuthShared.css';

function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
      const bundle = await register(form.email, form.password, form.displayName, form.role);
      if (bundle?.isOwner) navigate('/owner', { replace: true });
      else navigate('/cabinet', { replace: true });
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
        <p className="auth-card__subtitle">Создайте аккаунт пользователя или владельца базы</p>

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
            <select value={form.role} onChange={onChange('role')}>
              <option value="user">Рыболов (USER)</option>
              <option value="owner">Владелец базы (OWNER)</option>
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
