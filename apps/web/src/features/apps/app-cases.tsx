'use client';
/**
 * 应用用例管理页 — 左右分栏布局，带分类过滤
 * @author Antigravity/Gemini-2.5-Pro
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, Search, BookCopy, CheckSquare, Square, X, Folder, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { postGateway } from '@/lib/api/gateway-client';
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
}

interface CaseRecord {
  id: string;
  caseName: string;
  appCode: string;
  caseScope: string;
  categoryId: string;
  riskLevel: string;
  query: string;
  expectedBehavior: string;
  sourcePresetId?: string;
  enabled: boolean;
}

const riskLabel: Record<string, { label: string; color: string }> = {
  HIGH:   { label: '高', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  MEDIUM: { label: '中', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  LOW:    { label: '低', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
};

/** 加载分类（按应用范围或预置全局范围） */
async function fetchCategories(appCode?: string): Promise<Category[]> {
  const res = await postGateway<unknown>(
    'case',
    '/case/category/list.do',
    { page: { currentPage: 1, linesPerPage: 200 }, data: { appCode, includeGlobal: !appCode } },
    { cache: 'no-store' }
  );
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as Category[];
}

/** 加载应用用例 */
async function fetchAppCases(appCode: string, keyword = '', categoryId = ''): Promise<CaseRecord[]> {
  const res = await postGateway<unknown>(
    'case',
    '/case/list.do',
    { page: { currentPage: 1, linesPerPage: 200 }, data: { appCode, keyword, categoryId: categoryId === 'ALL' ? undefined : categoryId, caseScope: 'APP' } },
    { cache: 'no-store' }
  );
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as CaseRecord[];
}

/** 加载预置用例 */
async function fetchPresetCases(keyword = '', categoryId = ''): Promise<CaseRecord[]> {
  const res = await postGateway<unknown>(
    'case',
    '/case/preset/list.do',
    { page: { currentPage: 1, linesPerPage: 200 }, data: { keyword, categoryId: categoryId === 'ALL' ? undefined : categoryId } },
    { cache: 'no-store' }
  );
  const data = res as Record<string, unknown>;
  return (data?.list ?? []) as CaseRecord[];
}

async function importPresetCases(appCode: string, presetCaseIds: string[]): Promise<{ createdCount: number; message: string }> {
  const suiteCode = `suite-${appCode}-imported-${Date.now()}`;
  const res = await postGateway<unknown>('case', '/case/preset/import-to-app.do', {
    appCode,
    suiteCode,
    suiteName: '预置引用用例集',
    presetCaseIds,
    presetCaseCodes: presetCaseIds,
  });
  return res as { createdCount: number; message: string };
}

export function AppCasesPage({ appCode }: { appCode: string }) {
  // 分类与用例数据
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  // 新建表单
  const [formOpen, setFormOpen] = useState(false);

  // 预置引用弹窗
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetCategories, setPresetCategories] = useState<Category[]>([]);
  const [activePresetCategoryId, setActivePresetCategoryId] = useState('ALL');
  const [presetCases, setPresetCases] = useState<CaseRecord[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async (kw = keyword, cat = activeCategoryId) => {
    try {
      setLoading(true);
      const [cats, caseList] = await Promise.all([
        fetchCategories(appCode), // App cases can see global + app specific cats
        fetchAppCases(appCode, kw, cat)
      ]);
      setCategories(cats);
      setCases(caseList);
    } catch {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [appCode, keyword, activeCategoryId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData(keyword, activeCategoryId);
  };

  const handleCategorySelect = (id: string) => {
    setActiveCategoryId(id);
    void loadData(keyword, id);
  };

  // 打开预置引用弹窗
  const openPresetDialog = async () => {
    setPresetDialogOpen(true);
    setSelectedIds(new Set());
    setPresetSearch('');
    setActivePresetCategoryId('ALL');
    void loadPresetData('', 'ALL');
  };

  const loadPresetData = async (kw = presetSearch, cat = activePresetCategoryId) => {
    setPresetLoading(true);
    try {
      const [cats, list] = await Promise.all([
        fetchCategories('SYSTEM_PRESET'),
        fetchPresetCases(kw, cat)
      ]);
      setPresetCategories(cats);
      setPresetCases(list);
    } catch {
      toast.error('加载预置库失败');
    } finally {
      setPresetLoading(false);
    }
  };

  const handlePresetSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadPresetData(presetSearch, activePresetCategoryId);
  };

  const handlePresetCategorySelect = (id: string) => {
    setActivePresetCategoryId(id);
    void loadPresetData(presetSearch, id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(presetCases.map(c => c.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error('请至少选择一条预置用例');
      return;
    }
    setImporting(true);
    try {
      const result = await importPresetCases(appCode, Array.from(selectedIds));
      toast.success(result.message ?? `已引用 ${result.createdCount} 条用例`);
      setPresetDialogOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '引用失败';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">用例管理</h1>
            <p className="text-sm text-muted-foreground">共 {cases.length} 条用例</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openPresetDialog}>
            <BookCopy className="h-4 w-4" />从预置引用
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />新建用例
          </Button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* 左侧分类导航 */}
        <div className="w-56 border border-border bg-card rounded-xl flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-border font-medium text-sm text-foreground bg-muted/20">
            用例分类
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => handleCategorySelect('ALL')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                activeCategoryId === 'ALL' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              全部用例
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => handleCategorySelect(c.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  activeCategoryId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <Folder className="h-4 w-4" />
                {c.name}
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
                  placeholder="搜索用例名称或输入内容..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9">搜索</Button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
            {loading && <div className="text-center py-12 text-muted-foreground text-sm">加载中...</div>}

            {!loading && cases.map((c) => (
              <div key={c.id} className="bg-background border border-border rounded-xl p-4 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground">{c.caseName}</h3>
                      {c.sourcePresetId && (
                        <Badge variant="outline" className="text-xs font-normal">来自预置</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="bg-muted/50 rounded-md p-2">
                        <span className="text-xs text-muted-foreground font-medium mb-1 block">输入 (Query)</span>
                        <p className="text-sm font-mono text-foreground break-all">{c.query}</p>
                      </div>
                      {c.expectedBehavior && (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-md p-2">
                          <span className="text-xs text-emerald-600 font-medium mb-1 block">期望行为</span>
                          <p className="text-xs text-foreground break-all">{c.expectedBehavior}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', riskLabel[c.riskLevel]?.color ?? riskLabel.MEDIUM.color)}>
                      风险 {riskLabel[c.riskLevel]?.label ?? '中'}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {categories.find(cat => cat.id === c.categoryId)?.name || '未分类'}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {!loading && cases.length === 0 && (
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
        onSuccess={() => void loadData(keyword, activeCategoryId)}
      />

      {/* 从预置引用弹窗 */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-[900px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-5 border-b shrink-0">
            <DialogTitle>从预置库引用系统用例</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 bg-muted/10">
            {/* 左侧分类 */}
            <div className="w-52 border-r bg-card flex flex-col shrink-0">
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button
                  onClick={() => handlePresetCategorySelect('ALL')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    activePresetCategoryId === 'ALL' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />全部预置
                </button>
                {presetCategories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handlePresetCategorySelect(c.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                      activePresetCategoryId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                    )}
                  >
                    <Folder className="h-4 w-4" />{c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧列表 */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <div className="p-3 border-b flex items-center gap-2 shrink-0 bg-card">
                <form onSubmit={handlePresetSearch} className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-sm"
                    placeholder="搜索..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                  />
                </form>
                <Button type="submit" onClick={handlePresetSearch} variant="secondary" size="sm" className="h-9">搜索</Button>
                <div className="h-4 w-[1px] bg-border mx-1"></div>
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-9">全选</Button>
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-9">清空</Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  已选 {selectedIds.size}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {presetLoading && <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>}
                {!presetLoading && presetCases.map((c) => {
                  const selected = selectedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:shadow-sm',
                        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      )}
                      onClick={() => toggleSelect(c.id)}
                    >
                      <div className="mt-0.5 shrink-0 text-primary">
                        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{c.caseName}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', riskLabel[c.riskLevel]?.color ?? riskLabel.MEDIUM.color)}>
                            {riskLabel[c.riskLevel]?.label ?? '中'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-1.5 rounded truncate">{c.query}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0">
            <Button variant="ghost" onClick={() => setPresetDialogOpen(false)}>取消</Button>
            <Button onClick={handleImport} disabled={importing || selectedIds.size === 0}>
              {importing ? '引用中...' : `确认引用 (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
