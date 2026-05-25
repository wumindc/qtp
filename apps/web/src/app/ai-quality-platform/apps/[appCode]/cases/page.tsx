/**
 * 应用详情 - 用例管理页
 * @author Antigravity/Gemini-2.5-Pro
 */
import { AppCasesPage } from '@/features/apps/app-cases';

export default async function Page({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  return <AppCasesPage appCode={decodeURIComponent(appCode)} />;
}
