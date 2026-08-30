import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthContext';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import CookieBanner from './components/CookieBanner/CookieBanner';
import LegalModals from './components/LegalModals/LegalModals';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import AdminPage from './pages/AdminPage';
import NewsPage from './pages/NewsPage';
import PaidWatersPage from './pages/PaidWatersPage';
import FreeWatersPage from './pages/FreeWatersPage';
import AllNewsPage from './pages/AllNewsPage';
import MapPage from './pages/MapPage';
import DirectoryPage from './pages/DirectoryPage';
import ReportsPage from './pages/ReportsPage';
import ReportDetailPage from './pages/ReportDetailPage';
import ForumPage from './pages/ForumPage';
import ForumTopicPage from './pages/ForumTopicPage';
import AuthorProfilePage from './pages/AuthorProfilePage';
import CalendarPage from './pages/CalendarPage';
import LunarCalendarPage from './pages/LunarCalendarPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserCabinetPage from './pages/UserCabinetPage';
import OwnerCabinetPage from './pages/OwnerCabinetPage';
import PwaInstallPrompt from './components/pwa/PwaInstallPrompt';
import DocumentTitle from './components/seo/DocumentTitle';
import BaseDetailPage from './pages/BaseDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import ScrollToTop from './components/ScrollToTop';
import './App.css';

function RedirectBaseToWater() {
  const { id } = useParams();
  return <Navigate to={`/waters/${id}`} replace />;
}

function SiteLayout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <div className="app">
          <DocumentTitle />
          <CookieBanner />
          <LegalModals />
          <PwaInstallPrompt />

          <Routes>
            <Route path="/admin/*" element={<AdminPage />} />

            <Route
              path="*"
              element={
                <SiteLayout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/about" element={<AboutPage />} />
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
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/:id" element={<ReportDetailPage />} />
                    <Route path="/forum" element={<ForumPage />} />
                    <Route path="/forum/:id" element={<ForumTopicPage />} />
                    <Route path="/u/:userId" element={<AuthorProfilePage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/lunar" element={<LunarCalendarPage />} />
                    <Route path="/favorites" element={<Navigate to="/cabinet/favorites" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
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
    </AuthProvider>
  );
}

export default App;
