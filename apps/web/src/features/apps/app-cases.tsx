'use client';
/**
 * 应用用例管理页 — 左右分栏布局，带分类过滤
 * @author Antigravity/Gemini-2.5-Pro
 * @author codex
 */
import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from 'react';
import { ClipboardList, Plus, Search, BookCopy, CheckSquare, Square, Folder, FolderPlus, LayoutGrid, Edit, Trash2, MessageSquare, Target, Upload, Download, MoreVertical } from 'lucide-react';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import { getErrorMessage } from '@/lib/error';
import { buildCaseCsvTemplate, buildCaseExportFilename, downloadCaseCsv, formatCaseCsv, parseCaseCsv, readCaseCsvFile } from '@/features/cases/case-csv';
import { importCaseCsvRows } from '@/features/cases/api/case-api';
import { loadApp } from './api/app-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CaseFormDialog } from './case-form-dialog';

interface Category {
  id: string;
  name: string;
  description?: string;
  appCode?: string;
  isSubscribedPreset?: boolean;
}

type GatewayRow = Record<string, unknown>;

function mergeCategories(appCategories: Category[], subscribedCategories: Category[]) {
  const merged = new Map<string, Category>();
  appCategories.forEach((category) => merged.set(category.id, category));
  subscribedCategories.forEach((category) => {
    const existing = merged.get(category.id);
    merged.set(category.id, {
      ...existing,
      ...category,
      isSubscribedPreset: true,
    });
  });
  return Array.from(merged.values());
}

export interface CaseRecord {
  id: string;
  appCode: string;
  caseScope: string;
  categoryId: string;
  query: string;
  expectedBehavior: string;
  isSubscribedPreset?: boolean;
  enabled: boolean;
}

function readRequiredStringField(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value;
}

function readStringField(value: unknown, message: string) {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function readOptionalStringField(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function readNumberField(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message);
  return value;
}

function readBooleanField(value: unknown, message: string) {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function readOptionalBooleanField(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function mapCategoryRow(row: GatewayRow): Category {
  readNumberField(row.sortOrder, '应用用例分类响应缺少排序值');
  readBooleanField(row.enabled, '应用用例分类响应缺少启停状态');
  return {
    id: readRequiredStringField(row.id, '应用用例分类响应缺少分类 ID'),
    name: readRequiredStringField(row.name, '应用用例分类响应缺少分类名称'),
    description: readStringField(row.description, '应用用例分类响应缺少分类描述'),
    appCode: readOptionalStringField(row.appCode),
    isSubscribedPreset: readOptionalBooleanField(row.isSubscribedPreset),
  };
}

function mapCaseRow(row: GatewayRow): CaseRecord {
  return {
    id: readRequiredStringField(row.id, '应用用例响应缺少用例 ID'),
    appCode: readRequiredStringField(row.appCode, '应用用例响应缺少应用编码'),
    caseScope: readRequiredStringField(row.caseScope, '应用用例响应缺少用例范围'),
    categoryId: readRequiredStringField(row.categoryId, '应用用例响应缺少分类 ID'),
    query: readRequiredStringField(row.query, '应用用例响应缺少问题内容'),
    expectedBehavior: readRequiredStringField(row.expectedBehavior, '应用用例响应缺少期望回答'),
    enabled: readBooleanField(row.enabled, '应用用例响应缺少启停状态'),
    isSubscribedPreset: readOptionalBooleanField(row.isSubscribedPreset),
  };
}

function readStringArray(value: unknown, message: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(message);
  }
  return value;
}

function readMessageResponse(value: unknown, message: string) {
  if (!value || typeof value !== 'object') throw new Error(message);
  return { message: readRequiredStringField((value as GatewayRow).message, message) };
}

/** 加载分类（按应用范围或预置全局范围） */
async function fetchCategories(appCode?: string, isPreset = false): Promise<Category[]> {
  if (isPreset) {
    const res = await postGateway<unknown>('case', '/case/category/list.do', { page: { currentPage: 1, linesPerPage: 200 }, data: {} }, { cache: 'no-store' });
    return readGatewayList<GatewayRow>(res).map(mapCategoryRow);
  } else if (appCode) {
    const [appRes, subRes] = await Promise.all([
      postGateway<unknown>('case', '/case/category/list.do', { page: { currentPage: 1, linesPerPage: 200 }, data: { appCode, includeGlobal: false } }, { cache: 'no-store' }),
      postGateway<unknown>('case', '/case/category/list.do', { page: { currentPage: 1, linesPerPage: 200 }, data: { subscribedByApp: appCode } }, { cache: 'no-store' }),
    ]);
    const appCats = readGatewayList<GatewayRow>(appRes).map(mapCategoryRow);
    const subCats = readGatewayList<GatewayRow>(subRes).map(mapCategoryRow);
    return mergeCategories(appCats, subCats);
  }
  return [];
}

/** 加载应用用例 */
async function fetchAppCases(appCode: string, keyword = '', categoryId = ''): Promise<CaseRecord[]> {
  const res = await postGateway<unknown>(
    'case',
    '/case/list.do',
    { page: { currentPage: 1, linesPerPage: 200 }, data: { appCode, keyword, categoryId: categoryId === 'ALL' ? undefined : categoryId, caseScope: 'APP' } },
    { cache: 'no-store' }
  );
  return readGatewayList<GatewayRow>(res).map(mapCaseRow);
}

async function importPresetCategories(appCode: string, categoryIds: string[]): Promise<{ message: string }> {
  const res = await postGateway<unknown>('case', '/case/preset/import-categories-to-app.do', {
    appCode,
    categoryIds,
  });
  return readMessageResponse(res, '预置分类关联响应缺少消息');
}

async function fetchAppCategorySubscriptions(appCode: string): Promise<string[]> {
  const res = await postGateway<unknown>('case', '/case/preset/subscriptions.do', { appCode });
  return readStringArray(res, '预置分类订阅响应必须是分类 ID 数组');
}

async function unsubscribePresetCategory(appCode: string, categoryId: string): Promise<void> {
  await postGateway('case', '/case/preset/unsubscribe-category.do', { appCode, categoryId });
}

async function createAppCategory(appCode: string, category: { name: string; description: string }): Promise<Category> {
  return mapCategoryRow(await postGateway<GatewayRow>('case', '/case/category/create.do', {
    appCode,
    name: category.name.trim(),
    description: category.description.trim(),
  }));
}

export function AppCasesPage({ appCode }: { appCode: string }) {
  // 分类与用例数据
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [keyword, setKeyword] = useState('');

  // 新建/编辑表单
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | undefined>(undefined);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categorySaving, setCategorySaving] = useState(false);

  // 预置引用弹窗
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetCategories, setPresetCategories] = useState<Category[]>([]);
  const [selectedPresetCategoryIds, setSelectedPresetCategoryIds] = useState<string[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [appDisplayName, setAppDisplayName] = useState(appCode);
  const importInputRef = useRef<HTMLInputElement>(null);
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const csvExportRows = useMemo(
    () => cases.map((testCase) => ({
      categoryName: categoryNameById.get(testCase.categoryId) ?? '未分类',
      query: testCase.query,
      expectedBehavior: testCase.expectedBehavior,
    })),
    [cases, categoryNameById],
  );

  const loadData = useCallback(async (kw = keyword, cat = activeCategoryId) => {
    try {
      setLoading(true);
      const [cats, caseList] = await Promise.all([
        fetchCategories(appCode), // App cases can see global + app specific cats
        fetchAppCases(appCode, kw, cat)
      ]);
      setCategories(cats);
      setCases(caseList);
      setLoadError('');
    } catch (err: unknown) {
      console.error(err);
      const message = getErrorMessage(err, '加载数据失败');
      setLoadError(message);
      toast.error(`加载数据失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [appCode, keyword, activeCategoryId]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    setAppDisplayName(appCode);
    void loadApp(appCode)
      .then((app) => setAppDisplayName(app?.appName || appCode))
      .catch(() => setAppDisplayName(appCode));
  }, [appCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData(keyword, activeCategoryId);
  };

  const handleCategorySelect = (id: string) => {
    setActiveCategoryId(id);
    void loadData(keyword, id);
  };

  const handleCategoryDialogOpenChange = (open: boolean) => {
    setCategoryDialogOpen(open);
    if (!open) {
      setCategoryForm({ name: '', description: '' });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    if (!name || !description) {
      toast.error('请填写分类名称和分类描述');
      return;
    }

    setCategorySaving(true);
    try {
      const created = await createAppCategory(appCode, { name, description });
      toast.success('新建分类成功');
      setCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '' });
      const nextCategoryId = created.id || activeCategoryId;
      setActiveCategoryId(nextCategoryId);
      await loadData(keyword, nextCategoryId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '新建分类失败');
    } finally {
      setCategorySaving(false);
    }
  };

  // 打开预置引用弹窗
  const openPresetDialog = async () => {
    setPresetDialogOpen(true);
    setSelectedPresetCategoryIds([]);
    void loadPresetData();
  };

  const loadPresetData = async () => {
    setPresetLoading(true);
    try {
      const [cats, subs] = await Promise.all([
        fetchCategories(undefined, true),
        fetchAppCategorySubscriptions(appCode)
      ]);
      setPresetCategories(cats);
      setSelectedPresetCategoryIds(subs);
    } catch {
      toast.error('加载预置库失败');
    } finally {
      setPresetLoading(false);
    }
  };

  const handlePresetCategoryToggle = (id: string) => {
    setSelectedPresetCategoryIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSaveSubscriptions = async () => {
    setImporting(true);
    try {
      // Find what to subscribe and what to unsubscribe
      const currentSubs = await fetchAppCategorySubscriptions(appCode);
      const toSubscribe = selectedPresetCategoryIds.filter(id => !currentSubs.includes(id));
      const toUnsubscribe = currentSubs.filter(id => !selectedPresetCategoryIds.includes(id));

      if (toSubscribe.length > 0) {
        await importPresetCategories(appCode, toSubscribe);
      }
      for (const id of toUnsubscribe) {
        await unsubscribePresetCategory(appCode, id);
      }

      toast.success('预置分类关联已更新');
      setPresetDialogOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新失败';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await postGateway('case', '/case/delete.do', { id });
      toast.success('删除成功');
      void loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleDownloadTemplate = () => {
    downloadCaseCsv('应用用例导入模板.csv', buildCaseCsvTemplate());
  };

  const handleExportCases = () => {
    downloadCaseCsv(buildCaseExportFilename(`${appDisplayName}_应用用例导出`), formatCaseCsv(csvExportRows));
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
      await importCaseCsvRows('APP', rows, appCode);
      toast.success(`导入完成，共 ${rows.length} 条`);
      await loadData(keyword, activeCategoryId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">用例管理</h1>
            <p className="text-sm text-muted-foreground">共 {cases.length} 条用例</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <input
            ref={importInputRef}
            aria-label="导入应用用例 CSV"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void handleImportCsv(event)}
          />
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />下载模板
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4" />导入 CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCases} disabled={csvExportRows.length === 0}>
              <Download className="h-4 w-4" />导出 CSV
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
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  导入 CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCases} disabled={csvExportRows.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCategoryDialogOpen(true)}>
            <FolderPlus className="h-4 w-4" />新建分类
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openPresetDialog}>
            <BookCopy className="h-4 w-4" />从预置引用
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingCase(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />新建用例
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* 左侧分类导航 */}
        <div className="w-full md:w-56 border border-border bg-card rounded-xl flex flex-col shrink-0 overflow-hidden shadow-sm">
          <div className="p-3 border-b border-border font-medium text-sm text-foreground bg-muted/20 hidden md:block">
            用例分类
          </div>
          <div className="flex-none md:flex-1 flex md:flex-col overflow-x-auto md:overflow-y-auto md:overflow-x-hidden p-2 gap-1 hide-scrollbar whitespace-nowrap md:whitespace-normal">
            <button
              onClick={() => handleCategorySelect('ALL')}
              className={cn(
                'w-auto md:w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left shrink-0',
                activeCategoryId === 'ALL' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span className="truncate">全部用例</span>
              </div>
              {activeCategoryId === 'ALL' && (
                <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-sm font-medium shrink-0">
                  {cases.length}
                </span>
              )}
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => handleCategorySelect(c.id)}
                className={cn(
                  'w-auto md:w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left shrink-0',
                  activeCategoryId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.name}</span>
                  {c.isSubscribedPreset && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">预置</Badge>}
                </div>
                {activeCategoryId === c.id && (
                  <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-sm font-medium shrink-0">
                    {cases.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 右侧用例列表 */}
        <div className="flex-1 flex flex-col min-w-0 border border-border bg-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/10 shrink-0">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="搜索问题内容或期望回答..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9">搜索</Button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
            {loading && <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>}

            {!loading && loadError && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm">
                <p className="font-medium text-destructive">应用用例加载失败</p>
                <p className="mt-1 text-muted-foreground">{loadError}</p>
              </div>
            )}

            {!loading && !loadError && cases.map((c) => (
              <div key={c.id} className="group relative bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-border/80 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {activeCategoryId === 'ALL' && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {categoryNameById.get(c.categoryId) ?? '未分类'}
                      </Badge>
                    )}
                    {c.isSubscribedPreset && (
                      <Badge variant="outline" className="text-xs font-normal">来自预置</Badge>
                    )}
                  </div>
                  
                  {!c.isSubscribedPreset && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setEditingCase(c);
                          setFormOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <PopoverConfirm
                        title="确认删除用例"
                        description={`您确定要删除这个问题「${c.query}」吗？此操作不可恢复。`}
                        onConfirm={() => void handleDeleteCase(c.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PopoverConfirm>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> 问题内容
                    </div>
                    <div className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50 text-foreground break-all">
                      {c.query}
                    </div>
                  </div>
                  {c.expectedBehavior && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" /> 期望回答
                      </div>
                      <div className="text-sm bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 text-foreground break-all">
                        {c.expectedBehavior}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!loading && !loadError && cases.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-2">当前分类暂无用例</p>
                <p className="text-xs opacity-70 mb-4">您可以新建用例或从系统预置库引入</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新建用例弹窗 */}
      <CaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        appCode={appCode}
        categoryId={activeCategoryId !== 'ALL' ? activeCategoryId : undefined}
        categories={categories}
        editingCase={editingCase}
        onSuccess={() => void loadData(keyword, activeCategoryId)}
      />

      <Dialog open={categoryDialogOpen} onOpenChange={handleCategoryDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建用例分类</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="app-case-category-name">分类名称</Label>
              <Input
                id="app-case-category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="例如：应用边界"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-case-category-description">分类描述</Label>
              <Textarea
                id="app-case-category-description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="描述这个分类覆盖的测试场景"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleCategoryDialogOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? '创建中...' : '确认新建分类'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 从预置引用弹窗 */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>管理预置用例分类</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">请选择您需要关联的系统预置用例分类：</p>
            {presetLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
            ) : presetCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无预置分类</div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {presetCategories.map(c => {
                  const isSelected = selectedPresetCategoryIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePresetCategoryToggle(c.id);
                      }}
                      className={cn("flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors", isSelected ? 'border-primary/50 bg-primary/5' : 'border-border')}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium flex-1">{c.name}</span>
                      {isSelected && <Badge variant="secondary" className="text-xs font-normal shrink-0">已关联</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPresetDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveSubscriptions} disabled={importing}>
              {importing ? '保存中...' : '保存关联'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
