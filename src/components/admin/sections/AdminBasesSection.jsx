import { useEffect, useState, useCallback } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';

import { basesService } from '../../../services/basesService';

import { catalogAdminService } from '../../../services/catalogAdminService';

import BaseListingForm, { statusLabel } from '../../bases/BaseListingForm';

import {

  AdminPageHead,

  AdminAlert,

  AdminLoading,

  AdminStatus,

} from '../AdminUI';

import '../../bases/BaseListingForm.css';



export default function AdminBasesSection() {

  const { user, profile } = useAuth();

  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState('pending');

  const [items, setItems] = useState([]);

  const [selectedId, setSelectedId] = useState(null);

  const [selected, setSelected] = useState(null);

  const [reason, setReason] = useState('');

  const [error, setError] = useState('');

  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(true);



  const load = async () => {

    setLoading(true);

    setError('');

    try {

      const rows = await basesService.listForModeration(filter);

      setItems(rows);

      if (selectedId) {

        const fresh = rows.find((r) => String(r.id) === String(selectedId));

        if (fresh) setSelected(fresh);

      }

    } catch (err) {

      setError(err.message || 'Ошибка загрузки');

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    load();

  }, [filter]);



  const openItem = useCallback(

    async (id) => {

      const key = String(id);

      setSelectedId(key);

      setMessage('');

      setError('');

      setReason('');

      const fromList = items.find((r) => String(r.id) === key);

      try {

        const row = await basesService.getById(id, { isAdmin: true });

        if (row) {

          setSelected(row);

          return;

        }

        if (fromList) {

          setSelected(fromList);

          return;

        }

        setSelected(null);

        setError('Заявка не найдена');

      } catch (err) {

        if (fromList) {

          setSelected(fromList);

        } else {

          setSelected(null);

          setError(err.message || 'Не удалось открыть заявку');

        }

      }

    },

    [items]

  );



  useEffect(() => {

    const id = searchParams.get('id');

    if (!id || loading || items.length === 0) return;

    if (String(selectedId) === String(id) && selected) return;

    openItem(id);

  }, [searchParams, items, loading, selectedId, selected, openItem]);



  const runModeration = async (action) => {

    if (!selected) return;

    setError('');

    setMessage('');

    try {

      const updated = await basesService.moderate(user.id, selected.id, { action, reason });

      setSelected(updated);

      setMessage(

        action === 'approve' ? 'Одобрено' : action === 'reject' ? 'Отклонено' : 'Обновлено'

      );

      await load();

    } catch (err) {

      setError(err.message);

    }

  };



  const removeBase = async () => {

    if (!selected || !window.confirm('Удалить базу безвозвратно?')) return;

    setError('');

    setMessage('');

    try {

      await catalogAdminService.remove(user.id, selected.id, profile?.display_name);

      setSelected(null);

      setSelectedId(null);

      setMessage('Удалено');

      await load();

    } catch (err) {

      setError(err.message || 'Не удалось удалить');

    }

  };



  return (

    <>

      <AdminPageHead title="Рыболовные базы" subtitle="Модерация и редактирование заявок владельцев" />

      <AdminAlert type="error">{error}</AdminAlert>

      <AdminAlert type="success">{message}</AdminAlert>



      <div className="admin-toolbar">

        {['pending', 'approved', 'rejected', 'draft', 'archived', 'all'].map((s) => (

          <button

            key={s}

            type="button"

            className={`admin-btn ${filter === s ? 'admin-btn--primary' : ''}`}

            onClick={() => setFilter(s)}

          >

            {s === 'all' ? 'Все' : statusLabel(s)}

          </button>

        ))}

      </div>



      {loading ? (

        <AdminLoading />

      ) : (

        <div className="admin-split">

          <div>

            {items.length === 0 && <div className="admin-empty">Заявок нет</div>}

            {items.map((item) => (

              <button

                key={item.id}

                type="button"

                className={`admin-list-item${String(selectedId) === String(item.id) ? ' is-active' : ''}`}

                onClick={() => openItem(item.id)}

              >

                <div className="admin-list-item__title">{item.name}</div>

                <div className="admin-list-item__meta">

                  <AdminStatus status={item.status}>{statusLabel(item.status)}</AdminStatus>

                  {' · '}

                  {item.address}

                </div>

              </button>

            ))}

          </div>



          <div className="admin-panel">

            {!selected ? (

              <div className="admin-empty">Выберите заявку</div>

            ) : (

              <>

                <h3>{selected.name}</h3>

                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>

                  Владелец: {selected.owner_id}

                  {selected.rejection_reason && (

                    <>

                      <br />

                      Причина отказа: {selected.rejection_reason}

                    </>

                  )}

                </p>



                <BaseListingForm

                  key={`${selected.id}-${selected.updated_at}`}

                  initialForm={basesService.recordToForm(selected)}

                  submitLabel="Сохранить"

                  onSubmit={async (form) => {

                    const updated = await basesService.adminUpdate(user.id, selected.id, form);

                    setSelected(updated);

                    setMessage('Сохранено');

                    await load();

                  }}

                />



                <AdminField label="Причина отказа">

                  <textarea

                    className="admin-textarea"

                    rows={2}

                    value={reason}

                    onChange={(e) => setReason(e.target.value)}

                  />

                </AdminField>



                <div className="admin-toolbar">

                  <button type="button" className="admin-btn admin-btn--primary" onClick={() => runModeration('approve')}>

                    Одобрить

                  </button>

                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => runModeration('reject')}>

                    Отклонить

                  </button>

                  <button type="button" className="admin-btn" onClick={() => runModeration('archive')}>

                    Архив

                  </button>

                  <button type="button" className="admin-btn admin-btn--danger" onClick={removeBase}>

                    Удалить

                  </button>

                  <button type="button" className="admin-btn" onClick={() => runModeration('pending')}>

                    В pending

                  </button>

                </div>

              </>

            )}

          </div>

        </div>

      )}

    </>

  );

}



function AdminField({ label, children }) {

  return (

    <div className="admin-field" style={{ marginTop: 16 }}>

      <label>{label}</label>

      {children}

    </div>

  );

}


