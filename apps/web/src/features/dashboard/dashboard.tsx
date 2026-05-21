'use client';

import { useEffect, useState } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';

interface DashboardMetrics {
  appCount: number;
  caseCount: number;
  avgPassRate: number;
  pendingReviewCount: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  appCount: 0,
  caseCount: 0,
  avgPassRate: 0,
  pendingReviewCount: 0,
};

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    fetch(getGatewayApiUrl('statistics', '/report/dashboard.do'))
      .then((response) => response.json())
      .then((payload) => {
        const data = payload.data ?? payload;
        setMetrics({
          appCount: Number(data.appCount ?? 0),
          caseCount: Number(data.caseCount ?? 0),
          avgPassRate: Number(data.avgPassRate ?? 0),
          pendingReviewCount: Number(data.pendingReviewCount ?? 0),
        });
        setStatus('ready');
      })
      .catch(() => {
        setMetrics(EMPTY_METRICS);
        setStatus('error');
      });
  }, []);

  const cards = [
    ['AI 应用数', String(metrics.appCount), metrics.appCount > 0 ? '已接入平台的应用资产' : '暂无 AI 应用', '应用目录'],
    ['测试用例', String(metrics.caseCount), metrics.caseCount > 0 ? '来自数据库的用例总量' : '暂无测试用例', '用例库'],
    ['平均通过率', `${metrics.avgPassRate}%`, metrics.avgPassRate > 0 ? '按执行批次聚合计算' : '暂无执行统计', '质量态势'],
    ['待复核', String(metrics.pendingReviewCount), metrics.pendingReviewCount > 0 ? '需要人工确认的结果' : '暂无待复核结果', '人工复核'],
  ];
  const healthText = status === 'loading' ? '加载中' : status === 'ready' ? '服务端数据' : '统计服务暂不可用';

  return (
    <main className="console-stack">
      <header className="console-heading">
        <div>
          <h1>工作台</h1>
          <p>聚合 AI 应用测试评估的核心资产、执行质量和人工复核入口。</p>
        </div>
        <span className="console-soft-badge">{healthText}</span>
      </header>

      <section className="app-detail-hero">
        <div>
          <a className="app-back-link" href="/ai-quality-platform/apps">
            Quality Console
          </a>
          <h1>今日质量概览</h1>
          <p>所有数值直接来自统计服务，空库时保持真实空态。</p>
        </div>
        <div className="app-detail-actions">
          <a className="console-button" href="/ai-quality-platform/health">
            查看服务健康
          </a>
          <a className="console-button console-button-primary" href="/ai-quality-platform/apps">
            进入应用目录
          </a>
        </div>
      </section>

      <div className="app-detail-metrics">
        {cards.map(([label, value, desc, scope]) => (
          <section className="console-metric" key={label}>
            {/* @author codex: Metric cards reflect database state without local demo fallbacks. */}
            <span>{scope}</span>
            <strong>{value}</strong>
            <div className="mt-2 text-sm font-medium text-neutral-900">{label}</div>
            <div className="mt-1 text-xs text-neutral-500">{desc}</div>
          </section>
        ))}
      </div>

      <div className="app-detail-grid">
        <section className="app-detail-section">
          <div className="app-section-heading">
            <div>
              <h2>执行入口</h2>
              <p>从应用资产、用例库、执行结果到报告复盘，保持一条清晰工作流。</p>
            </div>
          </div>
          <div className="workflow-timeline">
            {['选择应用', '补充用例', '创建计划', '生成报告'].map((step, index) => (
              <a className={`workflow-step ${index < 2 ? 'is-done' : 'is-pending'}`} href="/ai-quality-platform/apps" key={step}>
                <span className="workflow-step-marker">{index + 1}</span>
                <span className="workflow-step-content">
                  <span className="workflow-step-kicker">
                    <span>{step}</span>
                    <em>{index < 2 ? '可进入' : '待执行'}</em>
                  </span>
                  <strong>{step}</strong>
                  <small>{index === 0 ? '进入应用工作区继续配置' : '按真实数据推进质量验证'}</small>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="app-detail-section">
          <div className="app-section-heading">
            <div>
              <h2>风险提示</h2>
              <p>统计服务不可用时仍保留页面结构，但不注入本地模拟数据。</p>
            </div>
          </div>
          <div className="next-action-panel">
            <div>
              <span>当前状态</span>
              <strong>{healthText}</strong>
              <p>{metrics.pendingReviewCount > 0 ? `${metrics.pendingReviewCount} 条结果等待复核。` : '暂无待复核结果。'}</p>
            </div>
            <a className="console-button" href="/ai-quality-platform/reviews">
              查看复核
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
