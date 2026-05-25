'use client';
/**
 * 预置用例 — 主页面（用例列表 + 分类列表两个标签页）
 * @author Antigravity/Gemini
 */
import { useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, FileText, FolderTree, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { cn } from '@/lib/cn';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import { CaseDialog } from './case-dialog';
import { CategoryDialog } from './category-dialog';
import { MOCK_CATEGORIES, MOCK_CASES } from './mock-hooks';
import type { PresetCase, PresetCategory, RiskLevel } from './types';

/* ── 风险颜色 ── */
const RISK_VARIANT: Record<RiskLevel, string> = {
  HIGH: 'text-destructive bg-destructive/10 border-destructive/20',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20',
  LOW: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20',
};

/* ── API 调用工具 ── */
async function postCase<T = unknown>(path: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(getGatewayApiUrl('case', path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: { currentPage: 1, linesPerPage: 50 }, data: payload }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || result.success === false) throw new Error(result.message ?? '请求失败');
  return result.data ?? result;
}

/* ══ 主组件 ══ */
export function CasesPage() {
  const [categories, setCategories] = useState<PresetCategory[]>(MOCK_CATEGORIES);
  const [cases, setCases] = useState<PresetCase[]>(MOCK_CASES);
  const [activeTab, setActiveTab] = useState<'cases' | 'categories'>('cases');
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PresetCase | null>(null);
  const [editingCategory, setEditingCategory] = useState<PresetCategory | null>(null);

  /* ── 计算 ── */
  const categoryCounts = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, 0]));
    cases.forEach((c) => map.set(c.categoryId, (map.get(c.categoryId) ?? 0) + 1));
    return map;
  }, [categories, cases]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const categoryCases = useMemo(
    () => (selectedCategoryId === 'ALL' ? cases : cases.filter((c) => c.categoryId === selectedCategoryId)),
    [cases, selectedCategoryId],
  );

  const visibleCases = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return categoryCases;
    return categoryCases.filter((c) =>
      [c.name, c.input, c.expected, c.categoryId].join(' ').toLowerCase().includes(kw),
    );
  }, [categoryCases, query]);

  /* ── 刷新 ── */
  const refresh = async () => {
    setRefreshing(true);
    try {
      const [catData, caseData] = await Promise.all([
        postCase<unknown>('/case/category/list.do', {}),
        postCase<unknown>('/case/preset/list.do', {}),
      ]);
      // 简单解析 gateway 响应
      const parseRows = (d: unknown) => {
        const s = d as { list?: unknown[]; records?: unknown[] };
        return (s?.list ?? s?.records ?? []) as Record<string, unknown>[];
      };
      setCategories(parseRows(catData).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? '未命名'),
        description: String(r.description ?? ''),
        sortOrder: String(r.sortOrder ?? '0'),
        status: r.enabled === false ? '停用' : '启用',
      })));
      setCases(parseRows(caseData).map((r) => ({
        id: String(r.id),
        name: String(r.caseName ?? r.name ?? '未命名'),
        categoryId: String(r.categoryId ?? 'GENERAL'),
        risk: (r.riskLevel ?? r.risk ?? 'MEDIUM') as RiskLevel,
        input: String(r.query ?? r.input ?? ''),
        expected: String(r.expectedBehavior ?? r.expected ?? ''),
        status: r.enabled === false ? '停用' : '启用',
      })));
      toast.success('预置用例库已刷新');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  /* ── 新增用例 ── */
  const handleSaveCase = async (data: Omit<PresetCase, 'id' | 'status'>) => {
    const newCase: PresetCase = { ...data, id: `local_${Date.now()}`, status: '启用' };
    try {
      const saved = await postCase<Record<string, unknown>>('/case/preset/create.do', {
        caseName: data.name,
        appCode: 'SYSTEM_PRESET',
        categoryId: data.categoryId,
        riskLevel: data.risk,
        query: data.input,
        expectedBehavior: data.expected,
      });
      newCase.id = String(saved.id ?? newCase.id);
    } catch {
      // 接口失败也保留本地状态
    }
    setCases((prev) => [newCase, ...prev]);
    setSelectedCategoryId(newCase.categoryId);
    toast.success('预置用例已保存');
  };

  /* ── 新增分类 ── */
  const handleSaveCategory = async (data: { name: string; description: string }) => {
    const newCat: PresetCategory = {
      id: `local_cat_${Date.now()}`,
      name: data.name,
      description: data.description,
      sortOrder: String((categories.length + 1) * 10),
      status: '启用',
    };
    try {
      const saved = await postCase<Record<string, unknown>>('/case/category/create.do', data);
      newCat.id = String(saved.id ?? newCat.id);
    } catch {
      // 静默保留本地
    }
    setCategories((prev) => [newCat, ...prev]);
    toast.success('分类已保存');
  };

  /* ── 切换用例状态 ── */
  const handleToggleCase = async (c: PresetCase) => {
    const enabled = c.status !== '启用';
    try {
      await postCase('/case/preset/change-enabled.do', { id: c.id, enabled });
    } catch {
      // 静默
    }
    setCases((prev) => prev.map((x) => x.id === c.id ? { ...x, status: enabled ? '启用' : '停用' } : x));
    toast.success(enabled ? '用例已启用' : '用例已停用');
  };

  /* ── 编辑用例（打开弹窗并预填数据） ── */
  const handleEditCase = (c: PresetCase) => {
    setEditingCase(c);
    setCaseDialogOpen(true);
  };

  /* ── 更新用例（编辑模式保存） ── */
  const handleUpdateCase = async (data: Omit<PresetCase, 'id' | 'status'>) => {
    if (!editingCase) return;
    const updated: PresetCase = { ...editingCase, ...data };
    try {
      await postCase('/case/preset/update.do', {
        id: editingCase.id,
        caseName: data.name,
        categoryId: data.categoryId,
        riskLevel: data.risk,
        query: data.input,
        expectedBehavior: data.expected,
      });
    } catch {
      // 静默降级
    }
    setCases((prev) => prev.map((x) => x.id === editingCase.id ? updated : x));
    setEditingCase(null);
    toast.success('用例已更新');
  };

  /* ── 删除用例 ── */
  const handleDeleteCase = async (c: PresetCase) => {
    try {
      await postCase('/case/preset/delete.do', { id: c.id });
    } catch {
      // 静默降级
    }
    setCases((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(`用例「${c.name}」已删除`);
  };

  /* ── 编辑分类 ── */
  const handleEditCategory = (cat: PresetCategory) => {
    setEditingCategory(cat);
    setCategoryDialogOpen(true);
  };

  /* ── 更新分类 ── */
  const handleUpdateCategory = async (data: { name: string; description: string }) => {
    if (!editingCategory) return;
    try {
      await postCase('/case/category/update.do', { id: editingCategory.id, ...data });
    } catch {
      // 静默降级
    }
    setCategories((prev) =>
      prev.map((x) => x.id === editingCategory.id ? { ...x, ...data } : x),
    );
    setEditingCategory(null);
    toast.success(`分类「${data.name}」已更新`);
  };

  /* ── 切换分类状态 ── */
  const handleToggleCategory = async (cat: PresetCategory) => {
    const enabled = cat.status !== '启用';
    try {
      await postCase('/case/category/change-enabled.do', { id: cat.id, enabled });
    } catch {
      // 静默降级
    }
    setCategories((prev) => prev.map((x) => x.id === cat.id ? { ...x, status: enabled ? '启用' : '停用' } : x));
    toast.success(enabled ? `分类「${cat.name}」已启用` : `分类「${cat.name}」已停用`);
  };

  /* ── 删除分类 ── */
  const handleDeleteCategory = async (cat: PresetCategory) => {
    const count = categoryCounts.get(cat.id) ?? 0;
    if (count > 0) {
      toast.error(`分类下还有 ${count} 条用例，请先移除或停用其用例`);
      return;
    }
    try {
      await postCase('/case/category/delete.do', { id: cat.id });
    } catch {
      // 静默降级
    }
    setCategories((prev) => prev.filter((x) => x.id !== cat.id));
    if (selectedCategoryId === cat.id) setSelectedCategoryId('ALL');
    toast.success(`分类「${cat.name}」已删除`);
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">系统预置测试用例</h1>
          <p className="text-sm text-muted-foreground mt-1">
            全局维护平台可复用的测试分类和预置用例，应用内只能引用。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            {refreshing ? '刷新中' : '刷新'}
          </Button>
          <Button
            size="sm"
            disabled={activeTab === 'cases' && categories.length === 0}
            onClick={() => activeTab === 'categories' ? setCategoryDialogOpen(true) : setCaseDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {activeTab === 'categories' ? '新增分类' : '新增用例'}
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '分类', value: categories.length },
          { label: '用例总数', value: cases.length },
          { label: '启用用例', value: cases.filter((c) => c.status === '启用').length },
          { label: '停用用例', value: cases.filter((c) => c.status === '停用').length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card px-5 py-4 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cases' | 'categories')}>
        <TabsList>
          <TabsTrigger value="cases">用例列表（{cases.length}）</TabsTrigger>
          <TabsTrigger value="categories">分类管理（{categories.length}）</TabsTrigger>
        </TabsList>

        {/* ── 用例面板 ── */}
        <TabsContent value="cases" className="mt-4">
          <div className="flex gap-4 h-full">
            {/* 分类侧栏 */}
            <aside className="w-56 shrink-0 space-y-1">
              <p className="px-3 text-xs font-medium text-muted-foreground mb-2">测试用例分类</p>
              <button
                type="button"
                onClick={() => setSelectedCategoryId('ALL')}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                  selectedCategoryId === 'ALL'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span>全部用例</span>
                <span className="text-xs opacity-70">{cases.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    selectedCategoryId === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    cat.status === '停用' && 'opacity-50',
                  )}
                >
                  <span className="truncate text-left">{cat.name}</span>
                  <span className="text-xs opacity-70 shrink-0 ml-1">{categoryCounts.get(cat.id) ?? 0}</span>
                </button>
              ))}
            </aside>

            <Separator orientation="vertical" className="h-auto" />

            {/* 用例列表 */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* 搜索 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索用例名称或期望行为"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {selectedCategory && (
                  <p className="text-xs text-muted-foreground">{selectedCategory.description}</p>
                )}
              </div>

              {/* 用例卡片 */}
              {visibleCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{query ? '没有匹配的用例' : '当前分类暂无用例'}</p>
                  {!query && categories.length > 0 && (
                    <Button size="sm" onClick={() => setCaseDialogOpen(true)}>新增预置用例</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleCases.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        'flex items-start gap-4 rounded-lg border bg-card px-5 py-4 transition-colors',
                        c.status === '停用' && 'opacity-60',
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{c.name}</p>
                          <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium', RISK_VARIANT[c.risk])}>
                            {c.risk}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {categoryNameById.get(c.categoryId) ?? '未归类'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{c.input || '（无输入）'}</p>
                        <p className="text-xs text-foreground/80 line-clamp-2">期望：{c.expected}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={c.status === '启用' ? 'default' : 'secondary'}
                          className={cn('w-12 justify-center', c.status === '启用' && 'bg-emerald-500 hover:bg-emerald-500/90')}
                        >
                          {c.status}
                        </Badge>
                        {/* 启用/停用 */}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={c.status === '启用' ? '停用' : '启用'}
                          onClick={() => void handleToggleCase(c)}
                        >
                          {c.status === '启用' ? (
                            <ShieldOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                        {/* 编辑 */}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="编辑用例"
                          onClick={() => handleEditCase(c)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {/* 删除 */}
                        <PopoverConfirm
                          title="删除用例"
                          description={`确认删除「${c.name}」？此操作不可恢复。`}
                          onConfirm={() => void handleDeleteCase(c)}
                        >
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="删除用例"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PopoverConfirm>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── 分类面板 ── */}
        <TabsContent value="categories" className="mt-4">
          <div className="space-y-2">
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <FolderTree className="h-8 w-8 opacity-40" />
                <p className="text-sm">暂无分类，请先添加</p>
                <Button size="sm" onClick={() => setCategoryDialogOpen(true)}>新增分类</Button>
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors',
                    cat.status === '停用' && 'opacity-60',
                  )}
                >
                  <FolderTree className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-sm font-semibold">{categoryCounts.get(cat.id) ?? 0}</p>
                    <p className="text-xs text-muted-foreground">用例</p>
                  </div>
                  <p className="hidden md:block text-xs text-muted-foreground shrink-0">排序 {cat.sortOrder}</p>
                  <Badge
                    variant={cat.status === '启用' ? 'default' : 'secondary'}
                    className={cn('shrink-0 w-12 justify-center', cat.status === '启用' && 'bg-emerald-500 hover:bg-emerald-500/90')}
                  >
                    {cat.status}
                  </Badge>
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 编辑 */}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="编辑分类"
                      onClick={() => handleEditCategory(cat)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    {/* 启用/停用 */}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title={cat.status === '启用' ? '停用分类' : '启用分类'}
                      onClick={() => void handleToggleCategory(cat)}
                    >
                      {cat.status === '启用' ? (
                        <ToggleRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {/* 删除 */}
                    <PopoverConfirm
                      title="删除分类"
                      description={`确认删除「${cat.name}」？该分类下所有用例将失去归属。`}
                      onConfirm={() => void handleDeleteCategory(cat)}
                    >
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="删除分类"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PopoverConfirm>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 弹窗 */}
      <CaseDialog
        open={caseDialogOpen}
        onOpenChange={(v) => { setCaseDialogOpen(v); if (!v) setEditingCase(null); }}
        categories={categories}
        editingCase={editingCase ?? undefined}
        onSave={editingCase ? handleUpdateCase : handleSaveCase}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(v) => { setCategoryDialogOpen(v); if (!v) setEditingCategory(null); }}
        editingCategory={editingCategory ?? undefined}
        onSave={editingCategory ? handleUpdateCategory : handleSaveCategory}
      />
    </div>
  );
}
