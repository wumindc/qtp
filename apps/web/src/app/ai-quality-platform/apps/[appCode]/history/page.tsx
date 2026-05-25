/**
 * 应用详情 - 执行历史页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { AppHistoryPage } from '@/features/apps/app-history';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppHistoryPage appCode={decodeURIComponent(appCode)} />;
}
