/**
 * AI 应用详情默认入口
 * @author codex
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AppDetailRoute({
  params,
}: {
  params: Promise<{ appCode: string }>;
}) {
  const { appCode } = await params;
  redirect(`/ai-quality-platform/apps/${encodeURIComponent(appCode)}/overview`);
}
