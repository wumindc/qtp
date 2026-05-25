'use client';
/**
 * 应用用例管理页 — 左右分栏布局，带分类过滤
 * @author Antigravity/Gemini-2.5-Pro
 * @author codex
 */
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Search, BookCopy, CheckSquare, Square, Folder, FolderPlus, LayoutGrid, Edit, Trash2, MessageSquare, Target } from 'lucide-react';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  description?: string;
  appCode?: string;
}

export interface CaseRecord {
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
async function fetchCategories(appCode?: string, isPreset = false): Promise<Category[]> {
  const data = isPreset ? {} : { appCode, includeGlobal: Boolean(appCode) };
  const res = await postGateway<unknown>(
    'case',
    '/case/category/list.do',
    { page: { currentPage: 1, linesPerPage: 200 }, data },
    { cache: 'no-store' }
  );
  const dataRes = res as Record<string, unknown>;
  return (dataRes?.list ?? []) as Category[];
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

async function importPresetCategories(appCode: string, categoryIds: string[]): Promise<{ createdCount: number; message: string }> {
  const suiteCode = `suite-${appCode}-imported-${Date.now()}`;
  const res = await postGateway<unknown>('case', '/case/preset/import-categories-to-app.do', {
    appCode,
    suiteCode,
    suiteName: '预置引用用例集',
    categoryIds,
  });
  return res as { createdCount: number; message: string };
}

async function createAppCategory(appCode: string, category: { name: string; description: string }): Promise<Category> {
  return postGateway<Category>('case', '/case/category/create.do', {
    appCode,
    name: category.name.trim(),
    description: category.description.trim(),
  });
}

export function AppCasesPage({ appCode }: { appCode: string }) {
  // 分类与用例数据
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadData = useCallback(async (kw = keyword, cat = activeCategoryId) => {
    try {
      setLoading(true);
      const [cats, caseList] = await Promise.all([
        fetchCategories(appCode), // App cases can see global + app specific cats
        fetchAppCases(appCode, kw, cat)
      ]);
      setCategories(cats);
      setCases(caseList);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? `加载数据失败: ${err.message}` : '加载数据失败');
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
      const cats = await fetchCategories(undefined, true);
      setPresetCategories(cats);
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

  const handleImport = async () => {
    if (selectedPresetCategoryIds.length === 0) {
      toast.error('请选择要引用的分类');
      return;
    }
    setImporting(true);
    try {
      const result = await importPresetCategories(appCode, selectedPresetCategoryIds);
      toast.success(result.message ?? `引用成功`);
      setPresetDialogOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '引用失败';
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
                'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left',
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
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left',
                  activeCategoryId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.name}</span>
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
              <div key={c.id} className="group relative bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-border/80 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-foreground">{c.caseName}</h3>
                    {c.sourcePresetId && (
                      <Badge variant="outline" className="text-xs font-normal">来自预置</Badge>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', riskLabel[c.riskLevel]?.color ?? riskLabel.MEDIUM.color)}>
                      风险 {riskLabel[c.riskLevel]?.label ?? '中'}
                    </span>
                  </div>
                  
                  {!c.sourcePresetId && (
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
                        description={`您确定要删除测试用例 "${c.caseName}" 吗？此操作不可恢复。`}
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
                      <MessageSquare className="h-3.5 w-3.5" /> 测试输入 (Query)
                    </div>
                    <div className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50 text-foreground break-all">
                      {c.query}
                    </div>
                  </div>
                  {c.expectedBehavior && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" /> 期望行为
                      </div>
                      <div className="text-sm bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 text-foreground break-all">
                        {c.expectedBehavior}
                      </div>
                    </div>
                  )}
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
            <DialogTitle>引用预置用例分类</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">请选择您需要引入到当前应用的系统预置用例分类：</p>
            {presetLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
            ) : presetCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无预置分类</div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {presetCategories.map(c => (
                  <label
                    key={c.id}
                    onClick={(e) => {
                      e.preventDefault();
                      handlePresetCategoryToggle(c.id);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    {selectedPresetCategoryIds.includes(c.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPresetDialogOpen(false)}>取消</Button>
            <Button onClick={handleImport} disabled={importing || selectedPresetCategoryIds.length === 0}>
              {importing ? '引用中...' : `确认引用 (${selectedPresetCategoryIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
