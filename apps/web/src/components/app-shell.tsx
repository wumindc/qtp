'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  Bot,
  Boxes,
  ClipboardList,
  Command,
  Gauge,
  HeartPulse,
  KeyRound,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: '工作台', href: '/ai-quality-platform', icon: Gauge },
  { label: 'AI 应用', href: '/ai-quality-platform/apps', icon: Bot },
  { label: '预置用例', href: '/ai-quality-platform/cases', icon: ClipboardList },
  { label: '模型中心', href: '/ai-quality-platform/providers', icon: Boxes },
  { label: '服务健康', href: '/ai-quality-platform/health', icon: HeartPulse },
] satisfies Array<{ label: string; href: string; icon: LucideIcon }>;

const APP_WORKSPACE_ITEMS = [
  { key: 'overview', label: '概览', icon: Gauge },
  { key: 'protocol', label: '接入配置', icon: KeyRound },
  { key: 'cases', label: '测试用例', icon: ClipboardList },
  { key: 'plans', label: '测试计划', icon: Layers3 },
  { key: 'executions', label: '执行历史', icon: Activity },
  { key: 'reports', label: '评估报告', icon: Sparkles },
] satisfies Array<{ key: string; label: string; icon: LucideIcon }>;

const APP_WORKSPACE_SECONDARY_ITEMS = [
  { label: '工作台', href: '/ai-quality-platform', icon: Gauge },
  { label: '预置用例', href: '/ai-quality-platform/cases', icon: ClipboardList },
  { label: '模型中心', href: '/ai-quality-platform/providers', icon: Boxes },
  { label: '服务健康', href: '/ai-quality-platform/health', icon: HeartPulse },
] satisfies Array<{ label: string; href: string; icon: LucideIcon }>;

export interface AppShellProps {
  children: ReactNode;
  currentPath?: string;
}

function getAppWorkspaceCode(currentPath: string) {
  const match = currentPath.match(/^\/ai-quality-platform\/apps\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function AppShell({ children, currentPath = '/ai-quality-platform' }: AppShellProps) {
  const appCode = getAppWorkspaceCode(currentPath);
  const [currentHash, setCurrentHash] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeWorkspaceKey = currentHash || 'overview';

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash.replace('#', ''));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [currentPath]);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('qtp-sidebar-collapsed') === 'true');
  }, []);

  const workspaceHrefBase = useMemo(() => (appCode ? `/ai-quality-platform/apps/${encodeURIComponent(appCode)}` : ''), [appCode]);
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('qtp-sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="console-app-shell" data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}>
      <aside className={`console-sidebar${appCode ? ' is-app-workspace' : ''}`} data-collapsed={sidebarCollapsed ? 'true' : 'false'}>
        <div className="console-brand">
          {/* @author codex: Brand block keeps the first viewport anchored on the platform identity. */}
          <div className="console-brand-mark" aria-hidden="true">
            <Command size={16} strokeWidth={2} />
          </div>
          <div className="console-brand-copy">
            <div className="console-brand-title">AI 质量平台</div>
            <div className="console-brand-subtitle">Quality Console</div>
          </div>
          <button className="console-sidebar-toggle" type="button" aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} onClick={toggleSidebar}>
            {sidebarCollapsed ? <PanelLeftOpen size={15} strokeWidth={1.9} aria-hidden="true" /> : <PanelLeftClose size={15} strokeWidth={1.9} aria-hidden="true" />}
          </button>
        </div>
        {appCode ? (
          <>
            <div className="console-workspace-context">
              <a className="console-workspace-return" href="/ai-quality-platform/apps" aria-label="返回 AI 应用列表" title="返回 AI 应用列表">
                <span className="console-workspace-return-icon" aria-hidden="true">
                  <ArrowLeft size={16} strokeWidth={1.9} />
                </span>
                <span className="console-workspace-return-copy">
                  <strong title={appCode}>{appCode}</strong>
                  <small>返回 AI 应用</small>
                </span>
              </a>
            </div>
            <nav className="console-nav console-nav-workspace" aria-label="应用工作区导航">
              {APP_WORKSPACE_ITEMS.map((item) => {
                const href = `${workspaceHrefBase}#${item.key}`;
                const active = activeWorkspaceKey === item.key;
                const Icon = item.icon;

                return (
                  <a className={active ? 'is-active' : ''} href={href} key={item.key} title={item.label}>
                    <span className="console-nav-icon" aria-hidden="true">
                      <Icon size={14} strokeWidth={1.9} />
                    </span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
            <div className="console-sidebar-bottom">
              <nav className="console-nav console-nav-secondary" aria-label="平台快捷入口">
                {APP_WORKSPACE_SECONDARY_ITEMS.map((item) => {
                  const Icon = item.icon;

                  return (
                    <a href={item.href} key={item.label} title={item.label}>
                      <span className="console-nav-icon" aria-hidden="true">
                        <Icon size={14} strokeWidth={1.9} />
                      </span>
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
              <div className="console-sidebar-footer">
                <span>Local</span>
                <strong>Gateway 8080</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <nav className="console-nav" aria-label="平台导航">
              {NAV_ITEMS.map((item) => {
                const active = currentPath === item.href || (item.href !== '/ai-quality-platform' && currentPath.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <a className={active ? 'is-active' : ''} href={item.href} key={item.label} title={item.label}>
                    <span className="console-nav-icon" aria-hidden="true">
                      <Icon size={14} strokeWidth={1.9} />
                    </span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
            <div className="console-sidebar-footer">
              <span>Local</span>
              <strong>Gateway 8080</strong>
            </div>
          </>
        )}
      </aside>
      <div className="console-main-shell">
        <header className="console-topbar">
          <div className="console-command" role="search" aria-label="全局搜索">
            {/* @author codex: Visual-only search command keeps the topbar aligned with console workflows. */}
            <Search size={14} strokeWidth={1.9} aria-hidden="true" /> 搜索应用、模型、执行批次或报告
          </div>
          <div className="console-topbar-actions">
            <a href="/ai-quality-platform/health">
              <HeartPulse size={14} strokeWidth={1.9} aria-hidden="true" /> 健康检查
            </a>
            <a href="/ai-quality-platform/login">
              <UserRound size={14} strokeWidth={1.9} aria-hidden="true" /> 管理员
            </a>
          </div>
        </header>
        <div className="console-content">{children}</div>
      </div>
    </div>
  );
}
