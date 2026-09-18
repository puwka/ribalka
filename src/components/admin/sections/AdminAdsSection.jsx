import { useAuth } from '../../auth/AuthContext';
import { AdminAdsTab } from '../AdminMonetization';
import { AdminPageHead } from '../AdminUI';

export default function AdminAdsSection() {
  const { user } = useAuth();
  return (
    <>
      <AdminPageHead title="Реклама" subtitle="Модерация боковых баннеров и рекламных размещений" />
      <section className="admin-panel">
        <AdminAdsTab adminId={user?.id} />
      </section>
    </>
  );
}
