import { loadApps } from '../../../features/apps/app-data';
import { AppCatalogPage } from '../../../features/apps/app-catalog-page';

export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const apps = await loadApps();

  return <AppCatalogPage initialApps={apps} />;
}
