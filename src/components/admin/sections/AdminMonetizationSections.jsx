import { AdminPlansTab, AdminPaymentsTab, AdminAdsTab } from '../AdminMonetization';
import { useAuth } from '../../auth/AuthContext';
import { AdminPageHead } from '../AdminUI';
import '../../owner/OwnerMonetization.css';

export function AdminPlansSection() {
  const { user } = useAuth();
  return (
    <>
      <AdminPageHead title="Тарифы" subtitle="CRUD тарифных планов" />
      <section className="admin-panel">
        <AdminPlansTab adminId={user.id} />
      </section>
    </>
  );
}

export function AdminPaymentsSection() {
  return (
    <>
      <AdminPageHead title="Платежи" subtitle="Все платежи платформы" />
      <section className="admin-panel">
        <AdminPaymentsTab />
      </section>
    </>
  );
}

export function AdminAdsSection() {
  const { user } = useAuth();
  return (
    <>
      <AdminPageHead title="Реклама" subtitle="Модерация и создание рекламных размещений" />
      <section className="admin-panel">
        <AdminAdsTab adminId={user.id} />
      </section>
    </>
  );
}
