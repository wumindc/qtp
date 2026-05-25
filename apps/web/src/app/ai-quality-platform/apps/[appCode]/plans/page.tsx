/**
 * 应用详情 - 执行计划页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { AppPlansPage } from '@/features/apps/app-plans';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppPlansPage appCode={decodeURIComponent(appCode)} />;
}
