import { loadModelCenterData } from '@/features/models/api/model-center-api';
import { ModelCenterPage } from '@/features/models/model-center-page';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  const { models, providers } = await loadModelCenterData();

  return <ModelCenterPage initialModels={models} initialProviders={providers} />;
}
