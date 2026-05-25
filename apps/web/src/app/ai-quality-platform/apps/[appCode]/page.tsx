/**
 * AI 应用详情页 — 重构存根
 * 原始代码已备份至同目录 .bak.tsx 文件
 * TODO: 按 design-deploy 规范逐步重构
 * @author Antigravity/Gemini
 */
export const dynamic = 'force-dynamic';

export default async function AppDetailRoute({
  params,
}: {
  params: Promise<{ appCode: string }>;
}) {
  const { appCode } = await params;
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <span className="text-4xl">🚧</span>
      <p className="text-sm font-medium">应用详情（{appCode}）— 重构中</p>
    </div>
  );
}
