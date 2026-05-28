'use client';
/**
 * 预置用例 — 主页面（用例列表 + 分类列表两个标签页）
 * @author Antigravity/Gemini
 * @author codex
 */
import { useMemo, useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { Plus, RefreshCw, Search, FileText, FolderTree, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight, Trash2, Pencil, Upload, Download, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { cn } from '@/lib/cn';
import { CaseDialog } from './case-dialog';
import { CategoryDialog } from './category-dialog';
import {
  loadCategories,
  loadPresetCases,
  saveCategory,
  saveCase,
  deleteCategory,
  deleteCase,
  changeCategoryStatus,
  changeCaseStatus,
  importCaseCsvRows
} from './api/case-api';
import { buildCaseCsvTemplate, buildCaseExportFilename, downloadCaseCsv, formatCaseCsv, parseCaseCsv, readCaseCsvFile } from './case-csv';
import type { PresetCase, PresetCategory } from './types';

/* ══ 主组件 ══ */
export function CasesPage() {
  const [categories, setCategories] = useState<PresetCategory[]>([]);
  const [cases, setCases] = useState<PresetCase[]>([]);
  const [activeTab, setActiveTab] = useState<'cases' | 'categories'>('cases');
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(true); // default true for initial load
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PresetCase | null>(null);
  const [editingCategory, setEditingCategory] = useState<PresetCategory | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
      [c.input, c.expected, categoryNameById.get(c.categoryId) ?? c.categoryId].join(' ').toLowerCase().includes(kw),
    );
  }, [categoryCases, categoryNameById, query]);

  const csvExportRows = useMemo(
    () => visibleCases.map((c) => ({
      categoryName: categoryNameById.get(c.categoryId) ?? '未归类',
      query: c.input,
      expectedBehavior: c.expected,
    })),
    [categoryNameById, visibleCases],
  );

  /* ── 刷新 ── */
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [catData, caseData] = await Promise.all([
        loadCategories(),
        loadPresetCases(),
      ]);
      setCategories(catData);
      setCases(caseData);
      if (!silent) toast.success('预置用例库已刷新');
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : '刷新失败');
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true).finally(() => setRefreshing(false));
  }, [refresh]);

  /* ── 新增用例 ── */
  const handleSaveCase = async (data: Omit<PresetCase, 'id' | 'status'>) => {
    try {
      await saveCase(data);
      toast.success('预置用例已保存');
      void refresh(true);
    } catch (e) {
      toast.error('保存失败');
    }
  };

  /* ── 新增分类 ── */
  const handleSaveCategory = async (data: { name: string; description: string }) => {
    try {
      await saveCategory(data);
      toast.success('分类已保存');
      void refresh(true);
    } catch (e) {
      toast.error('保存失败');
    }
  };

  /* ── 切换用例状态 ── */
  const handleToggleCase = async (c: PresetCase) => {
    const enabled = c.status !== '启用';
    try {
      await changeCaseStatus(c.id, enabled);
      setCases((prev) => prev.map((x) => x.id === c.id ? { ...x, status: enabled ? '启用' : '停用' } : x));
      toast.success(enabled ? '用例已启用' : '用例已停用');
    } catch {
      toast.error('状态更新失败');
    }
  };

  /* ── 编辑用例（打开弹窗并预填数据） ── */
  const handleEditCase = (c: PresetCase) => {
    setEditingCase(c);
    setCaseDialogOpen(true);
  };

  /* ── 更新用例（编辑模式保存） ── */
  const handleUpdateCase = async (data: Omit<PresetCase, 'id' | 'status'>) => {
    if (!editingCase) return;
    try {
      await saveCase(data, editingCase.id);
      toast.success('用例已更新');
      setEditingCase(null);
      void refresh(true);
    } catch {
      toast.error('更新失败');
    }
  };

  /* ── 删除用例 ── */
  const handleDeleteCase = async (c: PresetCase) => {
    try {
      await deleteCase(c.id);
      setCases((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('用例已删除');
    } catch {
      toast.error('删除失败');
    }
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
      await saveCategory(data, editingCategory.id);
      toast.success(`分类「${data.name}」已更新`);
      setEditingCategory(null);
      void refresh(true);
    } catch {
      toast.error('更新失败');
    }
  };

  /* ── 切换分类状态 ── */
  const handleToggleCategory = async (cat: PresetCategory) => {
    const enabled = cat.status !== '启用';
    try {
      await changeCategoryStatus(cat.id, enabled);
      setCategories((prev) => prev.map((x) => x.id === cat.id ? { ...x, status: enabled ? '启用' : '停用' } : x));
      toast.success(enabled ? `分类「${cat.name}」已启用` : `分类「${cat.name}」已停用`);
    } catch {
      toast.error('状态更新失败');
    }
  };

  /* ── 删除分类 ── */
  const handleDeleteCategory = async (cat: PresetCategory) => {
    const count = categoryCounts.get(cat.id) ?? 0;
    if (count > 0) {
      toast.error(`分类下还有 ${count} 条用例，请先移除或停用其用例`);
      return;
    }
    try {
      await deleteCategory(cat.id);
      setCategories((prev) => prev.filter((x) => x.id !== cat.id));
      if (selectedCategoryId === cat.id) setSelectedCategoryId('ALL');
      toast.success(`分类「${cat.name}」已删除`);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleDownloadTemplate = () => {
    downloadCaseCsv('预置用例导入模板.csv', buildCaseCsvTemplate());
  };

  const handleExportCases = () => {
    downloadCaseCsv(buildCaseExportFilename('预置用例导出'), formatCaseCsv(csvExportRows));
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = parseCaseCsv(await readCaseCsvFile(file));
      if (rows.length === 0) {
        toast.error('CSV 中没有可导入的用例');
        return;
      }
      await importCaseCsvRows('SYSTEM_PRESET', rows);
      toast.success(`导入完成，共 ${rows.length} 条`);
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      event.target.value = '';
    }
  };

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
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <input
            ref={importInputRef}
            aria-label="导入预置用例 CSV"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void handleImportCsv(event)}
          />
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />
              下载模板
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              导入 CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCases} disabled={activeTab !== 'cases' || csvExportRows.length === 0}>
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? '刷新中' : '刷新'}
            </Button>
          </div>

          {/* 移动端更多操作 */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
                  刷新
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  导入 CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCases} disabled={activeTab !== 'cases' || csvExportRows.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="sm"
            disabled={activeTab === 'cases' && categories.length === 0}
            onClick={() => activeTab === 'categories' ? setCategoryDialogOpen(true) : setCaseDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {activeTab === 'categories' ? '新增分类' : '新增用例'}
            </span>
            <span className="sm:hidden">新增</span>
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
          <div className="flex flex-col md:flex-row gap-4 h-full">
            {/* 分类侧栏 */}
            <aside className="flex md:w-56 shrink-0 flex-row md:flex-col overflow-x-auto md:overflow-visible hide-scrollbar space-x-2 md:space-x-0 md:space-y-1 pb-2 md:pb-0">
              <p className="hidden md:block px-3 text-xs font-medium text-muted-foreground mb-2">测试用例分类</p>
              <button
                type="button"
                onClick={() => setSelectedCategoryId('ALL')}
                className={cn(
                  'flex shrink-0 md:w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap',
                  selectedCategoryId === 'ALL'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 md:bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span>全部用例</span>
                <span className="text-xs opacity-70 ml-2">{cases.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    'flex shrink-0 md:w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap',
                    selectedCategoryId === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 md:bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                    cat.status === '停用' && 'opacity-50',
                  )}
                >
                  <span className="truncate text-left max-w-[120px] md:max-w-none">{cat.name}</span>
                  <span className="text-xs opacity-70 shrink-0 ml-2">{categoryCounts.get(cat.id) ?? 0}</span>
                </button>
              ))}
            </aside>

            <Separator orientation="vertical" className="hidden md:block h-auto" />
            <Separator orientation="horizontal" className="md:hidden w-full" />

            {/* 用例列表 */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* 搜索 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索问题内容或期望回答"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
                        {selectedCategoryId === 'ALL' && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {categoryNameById.get(c.categoryId) ?? '未归类'}
                            </Badge>
                          </div>
                        )}
                        <p className="text-sm text-foreground break-all">{c.input || '（无问题内容）'}</p>
                        <p className="text-xs text-foreground/80 line-clamp-2">期望回答：{c.expected}</p>
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
                          description={`确认删除这个问题「${c.input}」？此操作不可恢复。`}
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
