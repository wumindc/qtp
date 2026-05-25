/**
 * 应用详情 - 接口配置页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { AppProtocolPage } from '@/features/apps/app-protocol';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppProtocolPage appCode={decodeURIComponent(appCode)} />;
}
