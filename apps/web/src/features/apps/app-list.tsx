'use client';

/**
 * AI 应用列表页
 * 卡片网格布局，展示所有 AI 应用及其关键指标
 * @author Antigravity/Gemini-2.5-Pro
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Layers,
  Play,
  Pencil,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { loadApps, saveApp, deleteApp, changeAppStatus } from './api/app-api';
import { AppFormDialog } from './app-form-dialog';
import type { App } from './types';

/* ── 通过率颜色 ── */
function passRateColor(rate?: number) {
  if (rate === undefined) return 'text-muted-foreground';
  if (rate >= 90) return 'text-emerald-500';
  if (rate >= 70) return 'text-amber-500';
  return 'text-red-500';
}

/* ── 单张应用卡片 ── */
function AppCard({
  app,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  app: App;
  onEdit: (app: App) => void;
  onDelete: (appCode: string) => void;
  onToggleStatus: (appCode: string, status: App['status']) => void;
}) {
  const router = useRouter();

  const handleEnter = () => {
    router.push(`/ai-quality-platform/apps/${encodeURIComponent(app.appCode)}/overview`);
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col bg-card border border-border rounded-xl p-5 transition-all duration-200',
        'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer',
        app.status === 'DISABLED' && 'opacity-60',
      )}
      onClick={handleEnter}
    >
      {/* ── 操作菜单（不触发卡片点击）── */}
      <div
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(app)}>
              <Pencil className="h-4 w-4 mr-2" />
              编辑应用
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleStatus(app.appCode, app.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')}>
              {app.status === 'ENABLED' ? (
                <><XCircle className="h-4 w-4 mr-2" />停用应用</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />启用应用</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <PopoverConfirm
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除应用
                </DropdownMenuItem>
              }
              title="删除应用"
              description={`确定要删除「${app.appName}」吗？此操作不可撤销，相关用例和执行记录也将删除。`}
              onConfirm={() => onDelete(app.appCode)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 头部：图标 + 名称 + 状态 ── */}
      <div className="flex items-start gap-4 mb-4">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
          <Bot className="h-6 w-6 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground truncate">{app.appName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={app.status === 'ENABLED' ? 'default' : 'secondary'} className="text-xs">
              {app.status === 'ENABLED' ? '运行中' : '已停用'}
            </Badge>
            <Badge variant="outline" className="text-xs">{app.appType}</Badge>
          </div>
        </div>
      </div>

      {/* ── 接口地址 ── */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground truncate font-mono bg-muted/50 px-2 py-1 rounded">
          {app.protocol?.method ?? 'POST'} {app.protocol?.url || '未配置接口'}
        </p>
      </div>

      {/* ── 统计指标 ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-lg font-bold text-foreground">{app.stats?.caseCount ?? 0}</span>
          </div>
          <p className="text-xs text-muted-foreground">用例</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Play className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-lg font-bold text-foreground">{app.stats?.planCount ?? 0}</span>
          </div>
          <p className="text-xs text-muted-foreground">计划</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn('text-lg font-bold', passRateColor(app.stats?.lastPassRate))}>
              {app.stats?.lastPassRate !== undefined ? `${app.stats.lastPassRate}%` : '-'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">通过率</p>
        </div>
      </div>

      {/* ── 底部：最近执行时间 + 进入箭头 ── */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {app.stats?.lastRunAt
              ? `最近执行 ${new Date(app.stats.lastRunAt).toLocaleDateString('zh-CN')}`
              : '尚未执行'}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

/* ══ 主页面 ══ */
export function AppListPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await loadApps();
      setApps(data);
    } catch {
      toast.error('应用列表加载失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = apps.filter(
    (a) =>
      a.appName.includes(search) ||
      a.appCode.includes(search) ||
      (a.description ?? '').includes(search),
  );

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingApp(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Omit<App, 'appCode' | 'createdAt' | 'stats'>) => {
    try {
      await saveApp(data, editingApp?.appCode);
      toast.success(editingApp ? '应用更新成功' : '应用创建成功');
      setDialogOpen(false);
      setEditingApp(null);
      void refresh();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleDelete = async (appCode: string) => {
    try {
      await deleteApp(appCode);
      toast.success('删除成功');
      void refresh();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleToggleStatus = async (appCode: string, status: App['status']) => {
    try {
      await changeAppStatus(appCode, status);
      toast.success(status === 'ENABLED' ? '启用成功' : '停用成功');
      void refresh();
    } catch {
      toast.error('操作失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 页头 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI 应用</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理需要进行质量评测的业务 AI 接口
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          新建应用
        </Button>
      </div>

      {/* ── 搜索栏 ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索应用名称或编码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 个应用</span>
      </div>

      {/* ── 卡片网格 ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">暂无应用</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search ? '没有匹配的应用' : '还没有创建任何 AI 应用'}
          </p>
          {!search && (
            <Button onClick={handleCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              新建应用
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((app) => (
            <AppCard
              key={app.appCode}
              app={app}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* ── 新建/编辑弹窗 ── */}
      <AppFormDialog
        open={dialogOpen}
        editingApp={editingApp}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
