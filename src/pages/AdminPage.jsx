import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from '../components/auth/RequireAuth';
import AdminShell from '../components/admin/AdminShell';
import '../components/admin/AdminShell.css';

import AdminDashboard from '../components/admin/sections/AdminDashboard';
import AdminModerationHub from '../components/admin/sections/AdminModerationHub';
import AdminAuditSection from '../components/admin/sections/AdminAuditSection';
import AdminContentHome from '../components/admin/sections/AdminContentHome';
import { AdminContentPaidWaters, AdminContentFreeWaters } from '../components/admin/sections/AdminContentCatalogPages';
import AdminDirectorySection from '../components/admin/sections/AdminDirectorySection';
import AdminNewsSection from '../components/admin/sections/AdminNewsSection';
import AdminWatersSection from '../components/admin/sections/AdminWatersSection';
import AdminBasesSection from '../components/admin/sections/AdminBasesSection';
import AdminReportsSection from '../components/admin/sections/AdminReportsSection';
import AdminForumSection from '../components/admin/sections/AdminForumSection';
import AdminMediaSection from '../components/admin/sections/AdminMediaSection';
import AdminUsersSection from '../components/admin/sections/AdminUsersSection';
import AdminReviewsSection from '../components/admin/sections/AdminReviewsSection';
import { AdminPlansSection, AdminPaymentsSection } from '../components/admin/sections/AdminMonetizationSections';
import AdminSeoSection from '../components/admin/sections/AdminSeoSection';
import AdminSettingsSection from '../components/admin/sections/AdminSettingsSection';
import AdminDistrictsSection from '../components/admin/sections/AdminDistrictsSection';

export default function AdminPage() {
  return (
    <RequireRole roles={['admin']}>
      <Routes>
        <Route element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="moderation" element={<AdminModerationHub />} />
          <Route path="audit" element={<AdminAuditSection />} />
          <Route path="content/home" element={<AdminContentHome />} />
          <Route path="content/paid-waters" element={<AdminContentPaidWaters />} />
          <Route path="content/free-waters" element={<AdminContentFreeWaters />} />
          <Route path="content/directory" element={<AdminDirectorySection />} />
          <Route path="news" element={<AdminNewsSection />} />
          <Route path="waters" element={<AdminWatersSection />} />
          <Route path="bases" element={<AdminBasesSection />} />
          <Route path="reports" element={<AdminReportsSection />} />
          <Route path="forum" element={<AdminForumSection />} />
          <Route path="media" element={<AdminMediaSection />} />
          <Route path="users" element={<AdminUsersSection />} />
          <Route path="reviews" element={<AdminReviewsSection />} />
          <Route path="plans" element={<AdminPlansSection />} />
          <Route path="payments" element={<AdminPaymentsSection />} />
          <Route path="seo" element={<AdminSeoSection />} />
          <Route path="settings" element={<AdminSettingsSection />} />
          <Route path="districts" element={<AdminDistrictsSection />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </RequireRole>
  );
}
