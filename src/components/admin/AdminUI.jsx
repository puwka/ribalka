export function AdminPageHead({ title, subtitle, actions }) {
  return (
    <div className="admin-page-head">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-toolbar">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AdminAlert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={`admin-alert admin-alert--${type}`}>{children}</div>;
}

export function AdminEmpty({ children = 'Нет данных' }) {
  return <div className="admin-empty">{children}</div>;
}

export function AdminStatus({ status, children }) {
  const normalized = String(status || '').toLowerCase().replace(/\s/g, '_');
  return (
    <span className={`admin-status admin-status--${normalized}`}>
      {children || status}
    </span>
  );
}

export function AdminTable({ columns, rows, emptyText = 'Нет записей' }) {
  if (!rows?.length) return <AdminEmpty>{emptyText}</AdminEmpty>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._key || row.id}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminField({ label, hint, children, className = '' }) {
  return (
    <div className={`admin-field ${className}`.trim()}>
      {label ? <label>{label}</label> : null}
      {children}
      {hint ? <div className="admin-field__hint">{hint}</div> : null}
    </div>
  );
}

export function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <span className="admin-loading__spinner" aria-hidden="true" />
      <span>Загрузка…</span>
    </div>
  );
}
