import { WATER_TYPE } from '../lib/waterUtils';
import WaterCatalogPage from '../components/waters/WaterCatalogPage';

export default function FreeWatersPage() {
  return <WaterCatalogPage waterType={WATER_TYPE.FREE} />;
}
