import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';

export const HEALTH_SERVICES = [
  { key: 'business', name: 'quality-business-service' },
  { key: 'case', name: 'quality-case-service' },
  { key: 'plan', name: 'quality-plan-service' },
  { key: 'execution', name: 'quality-execution-service' },
  { key: 'ai', name: 'quality-ai-service' },
  { key: 'review', name: 'quality-review-service' },
  { key: 'statistics', name: 'quality-statistics-service' },
  { key: 'system', name: 'quality-system-service' },
] as const;

export function HealthPage() {
  const serviceGroups = [
    { label: '业务编排', keys: ['business', 'case', 'plan', 'execution'] },
    { label: '智能与复核', keys: ['ai', 'review', 'statistics', 'system'] },
  ];

  return (
    <section className="console-stack">
      <header className="console-heading">
        <div>
          <h1>服务健康检查</h1>
          <p>查看统一 Gateway 入口下的后端服务健康地址，保持与 Console 工作区同一套视觉结构。</p>
        </div>
        <span className="console-soft-badge">静态端点</span>
      </header>

      <div className="app-detail-metrics">
        {serviceGroups.map((group) => (
          <section className="console-metric" key={group.label}>
            {/* @author codex: Health overview groups endpoint metadata without issuing client-side probes. */}
            <span>{group.label}</span>
            <strong>{group.keys.length}</strong>
            <div className="mt-2 text-xs text-neutral-500">已登记健康检查入口</div>
          </section>
        ))}
        <section className="console-metric">
          <span>Gateway</span>
          <strong>{HEALTH_SERVICES.length}</strong>
          <div className="mt-2 text-xs text-neutral-500">服务统一代理地址</div>
        </section>
        <section className="console-metric">
          <span>状态</span>
          <strong>待检测</strong>
          <div className="mt-2 text-xs text-neutral-500">当前页面不注入模拟探活结果</div>
        </section>
      </div>

      <div className="related-table">
        <header>
          <h2>健康检查端点</h2>
          <p>后续接入实时探活时，可在同一列表内切换为真实检测状态。</p>
        </header>
        <div className="console-table-wrap">
          <table className="console-table app-case-table">
            <thead>
            <tr>
              <th>服务名称</th>
              <th>健康检查地址</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {HEALTH_SERVICES.map((service) => {
              const url = getGatewayApiUrl(service.key, '/health.do');

              return (
                <tr key={service.key}>
                  {/* @author codex: Static first version shows planned endpoints before live polling lands. */}
                  <td>
                    <strong>{service.name}</strong>
                    <small>{service.key}</small>
                  </td>
                  <td>{url}</td>
                  <td>
                    <span className="console-status-pill console-status-待处理">待检测</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
