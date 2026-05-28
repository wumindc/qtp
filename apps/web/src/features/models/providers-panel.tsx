'use client';
/**
 * 供应商面板 — 模型中心的供应商标签页
 * @author codex
 */
import { useState } from 'react';
import { Plus, Plug, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { cn } from '@/lib/cn';
import { PROVIDER_TYPE_META } from './model-center-schema';
import { ProviderDialog } from './provider-dialog';
import type { ModelProviderRecord, ProviderFormState } from './types';

interface ProvidersPanelProps {
  providers: ModelProviderRecord[];
  onSave: (form: ProviderFormState, editingCode?: string) => Promise<void>;
  onToggleStatus: (p: ModelProviderRecord) => Promise<void>;
  onDelete: (p: ModelProviderRecord) => Promise<void>;
  onTest: (p: ModelProviderRecord) => Promise<void>;
}

export function ProvidersPanel({ providers, onSave, onToggleStatus, onDelete, onTest }: ProvidersPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProviderRecord | null>(null);

  const handleEdit = (p: ModelProviderRecord) => {
    setEditingProvider(p);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const buildInitialForm = (p: ModelProviderRecord): ProviderFormState => ({
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
  });

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">AI 供应商</p>
          <p className="text-xs text-muted-foreground">管理 OpenAI、百炼、DeepSeek 等供应商接入配置</p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          新增供应商
        </Button>
      </div>

      {/* 列表 */}
      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Plug className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无供应商，请添加</p>
          <Button size="sm" onClick={handleAdd}>新增供应商</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => {
            const meta = PROVIDER_TYPE_META[p.type];
            return (
              <div
                key={p.code}
                className={cn(
                  'flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors',
                  p.status === '停用' && 'opacity-60',
                )}
              >
                {/* 名称 + 类型 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
                </div>

                {/* URL */}
                <div className="hidden lg:block min-w-0 max-w-[260px] text-right shrink-0">
                  <p className="text-xs text-muted-foreground font-mono truncate">{p.baseUrl}</p>
                </div>

                {/* 状态 */}
                <Badge
                  variant={p.status === '启用' ? 'default' : 'secondary'}
                  className={cn('shrink-0 w-12 justify-center', p.status === '启用' && 'bg-emerald-500 hover:bg-emerald-500/90')}
                >
                  {p.status}
                </Badge>

                {/* 操作 */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon-sm" variant="ghost" title="测试连接" onClick={() => void onTest(p)}>
                    <Plug className="h-4 w-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="编辑" onClick={() => handleEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title={p.status === '启用' ? '停用' : '启用'}
                    onClick={() => void onToggleStatus(p)}
                  >
                    {p.status === '启用' ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <PopoverConfirm
                    title="删除供应商"
                    description={`确认删除「${p.name}」？其下所有模型将同步失效。`}
                    onConfirm={() => void onDelete(p)}
                  >
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="删除"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PopoverConfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 弹窗 */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialForm={editingProvider ? buildInitialForm(editingProvider) : undefined}
        apiKeyRequired={!editingProvider}
        onSave={(form) => onSave(form, editingProvider?.code)}
        title={editingProvider ? '编辑供应商' : '新增供应商'}
      />
    </div>
  );
}
