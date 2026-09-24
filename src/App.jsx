import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthContext';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import CookieBanner from './components/CookieBanner/CookieBanner';
import DocumentTitle from './components/seo/DocumentTitle';
import YandexMetrikaHit from './components/seo/YandexMetrikaHit';
import ScrollToTop from './components/ScrollToTop';
import { ToastProvider } from './components/ui/ToastContext';
import './components/auth/AuthShared.css';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const PaidWatersPage = lazy(() => import('./pages/PaidWatersPage'));
const FreeWatersPage = lazy(() => import('./pages/FreeWatersPage'));
const AllNewsPage = lazy(() => import('./pages/AllNewsPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage'));
const DirectoryCategoryPage = lazy(() => import('./pages/DirectoryCategoryPage'));
const DirectoryPaymentResultPage = lazy(() => import('./pages/DirectoryPaymentResultPage'));
const TariffsPage = lazy(() => import('./pages/TariffsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ReportsAllPage = lazy(() => import('./pages/ReportsAllPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const ForumPage = lazy(() => import('./pages/ForumPage'));
const ForumTopicPage = lazy(() => import('./pages/ForumTopicPage'));
const AuthorProfilePage = lazy(() => import('./pages/AuthorProfilePage'));
const LunarCalendarPage = lazy(() => import('./pages/LunarCalendarPage'));
const UserCabinetPage = lazy(() => import('./pages/UserCabinetPage'));
const OwnerCabinetPage = lazy(() => import('./pages/OwnerCabinetPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SupportThanksPage = lazy(() => import('./pages/SupportThanksPage'));
const BaseDetailPage = lazy(() => import('./pages/BaseDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LegalModals = lazy(() => import('./components/LegalModals/LegalModals'));
const PwaInstallPrompt = lazy(() => import('./components/pwa/PwaInstallPrompt'));
const SupportFloat = lazy(() => import('./components/home/SupportFloat'));

function RedirectBaseToWater() {
  const { id } = useParams();
  return <Navigate to={`/waters/${id}`} replace />;
}

function PageFallback() {
  return (
    <div className="auth-loading" role="status" style={{ minHeight: '40vh' }}>
      <div className="auth-loading__spinner" />
      <p>Загрузка…</p>
    </div>
  );
}

function SiteLayout({ children }) {
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <SupportFloat />
      </Suspense>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ScrollToTop />
          <div className="app">
            <DocumentTitle />
            <YandexMetrikaHit />
            <CookieBanner />
            <Suspense fallback={null}>
              <LegalModals />
              <PwaInstallPrompt />
            </Suspense>

            <Routes>
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AdminPage />
                  </Suspense>
                }
              />

              <Route
                path="*"
                element={
                  <SiteLayout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="/support/thanks" element={<SupportThanksPage />} />
                      <Route path="/news/all" element={<AllNewsPage />} />
                      <Route path="/news/:id" element={<NewsPage />} />
                      <Route path="/paid-waters" element={<PaidWatersPage />} />
                      <Route path="/free-waters" element={<FreeWatersPage />} />
                      <Route path="/waters/:id" element={<BaseDetailPage />} />
                      <Route path="/bases/:id" element={<RedirectBaseToWater />} />
                      <Route path="/paid-bases/all" element={<Navigate to="/paid-waters" replace />} />
                      <Route path="/free-places/all" element={<Navigate to="/free-waters" replace />} />
                      <Route path="/map" element={<MapPage />} />
                      <Route path="/directory" element={<DirectoryPage />} />
                      <Route
                        path="/directory/payment/result/:orderId"
                        element={<DirectoryPaymentResultPage />}
                      />
                      <Route path="/directory/:tab" element={<DirectoryCategoryPage />} />
                      <Route path="/tariffs" element={<TariffsPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/reports/all" element={<ReportsAllPage />} />
                      <Route path="/reports/:id" element={<ReportDetailPage />} />
                      <Route path="/forum" element={<ForumPage />} />
                      <Route path="/forum/:id" element={<ForumTopicPage />} />
                      <Route path="/u/:userId" element={<AuthorProfilePage />} />
                      <Route path="/calendar" element={<Navigate to="/lunar" replace />} />
                      <Route path="/lunar" element={<LunarCalendarPage />} />
                      <Route path="/favorites" element={<Navigate to="/cabinet/favorites" replace />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/cabinet/*" element={<UserCabinetPage />} />
                      <Route path="/owner/*" element={<OwnerCabinetPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </SiteLayout>
                }
              />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
