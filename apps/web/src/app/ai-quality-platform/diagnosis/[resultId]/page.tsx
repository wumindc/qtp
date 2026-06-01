/**
 * @author qtp
 * 失败诊断页（Server Component，直读 SQLite）。
 */
import { notFound } from 'next/navigation';
import { getDiagnosis } from '@/lib/server/qtp-queries';
import { DiagnosisScreen } from '@/features/diagnosis/diagnosis-view';

export const dynamic = 'force-dynamic';

export default async function DiagnosisPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const id = Number(resultId);
  if (!Number.isFinite(id)) notFound();
  const data = await getDiagnosis(id);
  if (!data) notFound();
  return <DiagnosisScreen data={data} />;
}
