import { WATER_TYPE } from '../lib/waterUtils';
import WaterCatalogPage from '../components/waters/WaterCatalogPage';

export default function PaidFishingPage() {
  return <WaterCatalogPage waterType={WATER_TYPE.PAID_FISHING} />;
}
