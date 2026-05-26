/**
 * 应用评估配置路由
 * @author codex
 */
import { AppEvaluationPage } from '@/features/apps/app-evaluation';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppEvaluationPage appCode={decodeURIComponent(appCode)} />;
}
