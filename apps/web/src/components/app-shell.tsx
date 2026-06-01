'use client';

/**
 * 应用主框架 - 侧边导航 + 内容区域
 * 支持二级导航：进入应用后菜单切换为应用子菜单，平台菜单下沉到底部
 * @author Antigravity/Gemini-2.5-Pro
 * @author codex
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { loadApp } from '@/features/apps/api/app-api';
import {
  ArrowLeft,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  Gauge,
  GitCompare,
  HeartPulse,
  KeyRound,
  Layers3,
  BrainCircuit,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/sidebar/theme-toggle';
import { UserMenu } from '@/components/sidebar/user-menu';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/* ── 平台主导航菜单 ── */
const NAV_ITEMS = [
  { label: '工作台', href: '/ai-quality-platform', icon: Gauge, exact: true },
  { label: '回归对比', href: '/ai-quality-platform/compare/CMP-0001', icon: GitCompare },
  { label: 'AI 应用', href: '/ai-quality-platform/apps', icon: Bot, matchPrefix: '/ai-quality-platform/apps' },
  { label: '预置用例', href: '/ai-quality-platform/cases', icon: ClipboardList },
  { label: '模型中心', href: '/ai-quality-platform/providers', icon: Boxes },
  { label: '服务健康', href: '/ai-quality-platform/health', icon: HeartPulse },
] satisfies Array<{ label: string; href: string; icon: LucideIcon; exact?: boolean; matchPrefix?: string }>;

/* ── 应用工作区子导航 ── */
const APP_NAV_ITEMS = [
  { key: 'overview', label: '概览', icon: Gauge },
  { key: 'protocol', label: '接口配置', icon: KeyRound },
  { key: 'evaluation', label: '评估配置', icon: BrainCircuit },
  { key: 'cases', label: '用例管理', icon: ClipboardList },
  { key: 'plans', label: '执行计划', icon: Layers3 },
] satisfies Array<{ key: string; label: string; icon: LucideIcon }>;

/* ── 平台层下沉菜单（进入应用后显示在底部）── */
const NAV_ITEMS_SECONDARY = [
  { label: 'AI 应用', href: '/ai-quality-platform/apps', icon: Bot },
  { label: '预置用例', href: '/ai-quality-platform/cases', icon: ClipboardList },
  { label: '模型中心', href: '/ai-quality-platform/providers', icon: Boxes },
  { label: '服务健康', href: '/ai-quality-platform/health', icon: HeartPulse },
] satisfies Array<{ label: string; href: string; icon: LucideIcon }>;

/* ── 工具函数：从路径提取 appCode ── */
function getAppCode(path: string) {
  const match = path.match(/^\/ai-quality-platform\/apps\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/* ── 工具函数：应用内当前激活的 tab ── */
function getAppTab(path: string) {
  const match = path.match(/^\/ai-quality-platform\/apps\/[^/?#]+\/([^/?#]+)/);
  return match ? match[1] : 'overview';
}

/* ── Nav item 样式 ── */
function navItemCls(active: boolean, collapsed: boolean, secondary = false) {
  return cn(
    'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 px-3 py-2',
    active
      ? 'bg-primary text-primary-foreground shadow-sm'
      : secondary
        ? 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
    collapsed && 'justify-center px-2',
    secondary && 'text-[13px]',
  );
}

/* ══ 带 Tooltip 的导航链接 ══ */
function NavLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  secondary = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  secondary?: boolean;
}) {
  const link = (
    <Link href={href} className={navItemCls(active, collapsed, secondary)}>
      <Icon className={cn('shrink-0', secondary ? 'h-4 w-4' : 'h-5 w-5')} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ══ 折叠/展开按钮 ══ */
function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? '展开菜单' : '收起菜单'}
          className={cn(
            'flex w-full items-center justify-center rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            !collapsed && 'gap-2',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>收起菜单</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">展开菜单</TooltipContent>}
    </Tooltip>
  );
}

/* ══════════════════════════════════════════
   主组件
══════════════════════════════════════════ */
export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const appCode = getAppCode(pathname);
  const currentTab = getAppTab(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [appName, setAppName] = useState<string | null>(null);

  // 当进入应用时加载应用名称
  useEffect(() => {
    if (appCode) {
      setAppName(null);
      void loadApp(appCode).then((app) => {
        setAppName(app?.appName ?? appCode);
      }).catch(() => {
        setAppName(appCode);
      });
    } else {
      setAppName(null);
    }
  }, [appCode]);

  // 路由切换时自动关闭移动端侧边栏
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage?.getItem('qtp-sidebar-collapsed') === 'true');
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem('qtp-sidebar-collapsed', String(next));
      } catch {
        // localStorage can be unavailable in tests or privacy-restricted browsers.
      }
      return next;
    });
  };

  const appBase = appCode
    ? `/ai-quality-platform/apps/${encodeURIComponent(appCode)}`
    : '';

  const renderSidebar = (isMobile: boolean = false) => {
    const isCollapsed = isMobile ? false : collapsed;
    return (
      <>
        {/* ── Logo ── */}
        <div className="flex items-center h-14 border-b border-border shrink-0 px-3">
          <div className={cn('flex items-center gap-3 overflow-hidden', isCollapsed && 'w-full justify-center')}>
            <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Command className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <span className="text-base font-semibold text-foreground whitespace-nowrap">
                AI 质量平台
              </span>
            )}
          </div>
        </div>

        {/* ══ 工作区模式（进入某个应用后）══ */}
        {appCode ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* ── 返回 + 应用名 ── */}
            <div className="shrink-0 px-3 pt-3 pb-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/ai-quality-platform/apps"
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1',
                      isCollapsed && 'justify-center px-2',
                    )}
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="font-medium">返回应用列表</span>}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">返回应用列表</TooltipContent>}
              </Tooltip>

              {/* 应用名标识 */}
              {!isCollapsed && (
                <div className="px-3 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">
                    当前应用
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {appName ?? appCode}
                  </p>
                </div>
              )}
            </div>

            {/* 分隔线 */}
            <div className="shrink-0 mx-3 h-px bg-border mb-1" />

            {/* ── 应用子菜单（主要，占满空间）── */}
            <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto" aria-label="应用子菜单">
              {APP_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.key}
                  href={`${appBase}/${item.key}`}
                  icon={item.icon}
                  label={item.label}
                  active={currentTab === item.key}
                  collapsed={isCollapsed}
                />
              ))}
            </nav>

            {/* ── 分隔线 ── */}
            <div className="shrink-0 mx-3 h-px bg-border mt-1" />

            {/* ── 平台菜单下沉区（次要，视觉弱化）── */}
            <div className="shrink-0 px-3 py-2 space-y-0.5">
              {!isCollapsed && (
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                  平台
                </p>
              )}
              {NAV_ITEMS_SECONDARY.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={false}
                  collapsed={isCollapsed}
                  secondary
                />
              ))}
            </div>

            {/* ── 底部工具栏 ── */}
            <div className="shrink-0 p-3 space-y-1 border-t border-border">
              <ThemeToggle collapsed={isCollapsed} />
              <UserMenu collapsed={isCollapsed} name="管理员" role="系统管理员" />
              {!isMobile && <CollapseButton collapsed={isCollapsed} onToggle={toggle} />}
            </div>
          </div>
        ) : (
          /* ══ 标准平台导航模式 ══ */
          <>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="平台导航">
              {NAV_ITEMS.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <NavLink
                    key={item.label}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={active}
                    collapsed={isCollapsed}
                  />
                );
              })}
            </nav>

            <div className="shrink-0 p-3 space-y-1 border-t border-border">
              <ThemeToggle collapsed={isCollapsed} />
              <UserMenu collapsed={isCollapsed} name="管理员" role="系统管理员" />
              {!isMobile && <CollapseButton collapsed={isCollapsed} onToggle={toggle} />}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background w-full">
        {/* ══ 桌面端侧边栏 ══ */}
        <aside
          className={cn(
            'hidden md:flex flex-col h-screen shrink-0 border-r border-border bg-card transition-all duration-300',
            collapsed ? 'w-16' : 'w-[220px]',
          )}
        >
          {renderSidebar(false)}
        </aside>

        {/* ══ 内容区容器 ══ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden h-screen">
          {/* ══ 移动端顶部导航栏 ══ */}
          <header className="md:hidden flex items-center h-14 px-4 border-b border-border bg-card shrink-0 gap-3">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button aria-label="打开导航菜单" className="p-2 -ml-2 rounded-md hover:bg-accent text-foreground">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 flex flex-col h-full bg-card border-r-0">
                <SheetTitle className="sr-only">导航菜单</SheetTitle>
                {renderSidebar(true)}
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-sm truncate">
              {appCode ? (appName ?? appCode) : 'AI 质量平台'}
            </span>
          </header>

          {/* ══ 主内容区 ══ */}
          <main className="flex-1 overflow-y-auto bg-background relative">
            <div className="p-4 md:p-6 min-h-full">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
