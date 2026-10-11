import Hero from '../components/Hero/Hero';
import WatersHomeSection from '../components/home/WatersHomeSection';
import PaidFishingHomeSection from '../components/home/PaidFishingHomeSection';
import FreePlacesHomeSection from '../components/home/FreePlacesHomeSection';
import SupportProjectSection from '../components/home/SupportProjectSection';
import News from '../components/News/News';
import { CMS_PAGES } from '../services/cmsService';
import { useCmsPage } from '../hooks/useCms';
import './HomePage.css';

export default function HomePage() {
  const { data: cms } = useCmsPage(CMS_PAGES.HOME);
  const blocks = cms?.blocks || {};

  const showWaters = blocks.watersSection?.enabled !== false;
  const showNews = blocks.newsSection?.enabled !== false;
  const showSupport = blocks.support?.enabled !== false;

  return (
    <div className="home-page">
      <div className="home-epic">
        <Hero />
        {showWaters && <WatersHomeSection />}
        {showWaters && <PaidFishingHomeSection />}
        {showWaters && <FreePlacesHomeSection />}
        {showNews && <News />}
        {showSupport && <SupportProjectSection config={blocks.support || {}} />}
      </div>
    </div>
  );
}
