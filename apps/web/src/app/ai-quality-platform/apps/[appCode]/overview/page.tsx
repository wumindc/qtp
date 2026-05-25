/**
 * 应用详情 - 概览页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { AppOverviewPage } from '@/features/apps/app-overview';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppOverviewPage appCode={decodeURIComponent(appCode)} />;
}
