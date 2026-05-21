import { AppDetailPage } from '../../../../features/apps/app-detail-page';
import { loadAppDetail } from '../../../../features/apps/app-data';

export const dynamic = 'force-dynamic';

export default async function AppDetailRoute({ params }: { params: Promise<{ appCode: string }> }) {
  const { appCode } = await params;
  const data = await loadAppDetail(appCode);

  if (!data) {
    return (
      <section className="app-detail-page">
        <div className="app-detail-section app-empty-state">
          {/* @author codex: Missing applications should be explicit instead of falling back to another workspace. */}
          <h1>应用不存在或已删除</h1>
          <p>当前数据库中没有找到这个 AI 应用，请返回应用列表后重新选择或新建应用。</p>
          <a className="console-button console-button-primary" href="/ai-quality-platform/apps">
            返回 AI 应用
          </a>
        </div>
      </section>
    );
  }

  return <AppDetailPage data={data} />;
}
