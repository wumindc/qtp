/**
 * @author qtp
 * 执行对比页（Server Component，直读 SQLite）。
 */
import { notFound } from 'next/navigation';
import { getComparison } from '@/lib/server/qtp-queries';
import { ComparisonScreen } from '@/features/comparison/comparison-view';

export const dynamic = 'force-dynamic';

export default async function ComparePage({ params }: { params: Promise<{ comparisonCode: string }> }) {
  const { comparisonCode } = await params;
  const data = await getComparison(decodeURIComponent(comparisonCode));
  if (!data) notFound();
  return <ComparisonScreen data={data} />;
}
