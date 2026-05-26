/**
 * 应用详情 - 执行历史记录详情页
 * @author codex
 */
import { AppHistoryDetail } from '@/features/apps/app-history-detail';

export default async function Page({
  params,
}: {
  params: Promise<{ appCode: string; runCode: string }>;
}) {
  const { appCode, runCode } = await params;
  const decodedAppCode = decodeURIComponent(appCode);

  return (
    <AppHistoryDetail
      runCode={decodeURIComponent(runCode)}
      backHref={`/ai-quality-platform/apps/${encodeURIComponent(decodedAppCode)}/history`}
    />
  );
}
