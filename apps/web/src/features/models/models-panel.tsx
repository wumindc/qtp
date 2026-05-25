'use client';
/**
 * 模型面板 — 模型中心的模型标签页
 * @author Antigravity/Gemini
 */
import { useState } from 'react';
import { Plus, Brain, Pencil, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PopoverConfirm } from '@/components/ui/popover-confirm';
import { cn } from '@/lib/cn';
import { PROTOCOL_META, formatTokenDisplay } from './model-center-schema';
import { ModelDialog } from './model-dialog';
import type { ModelCenterRecord, ModelFormState, ModelProviderRecord } from './types';

interface ModelsPanelProps {
  models: ModelCenterRecord[];
  providers: ModelProviderRecord[];
  onSave: (form: ModelFormState, provider: ModelProviderRecord, editingId?: string) => Promise<void>;
  onToggleStatus: (m: ModelCenterRecord) => Promise<void>;
  onDelete: (m: ModelCenterRecord) => Promise<void>;
  onTest: (m: ModelCenterRecord) => Promise<void>;
}

export function ModelsPanel({ models, providers, onSave, onToggleStatus, onDelete, onTest }: ModelsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelCenterRecord | null>(null);

  const handleEdit = (m: ModelCenterRecord) => {
    setEditingModel(m);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingModel(null);
    setDialogOpen(true);
  };

  const buildInitialForm = (m: ModelCenterRecord): ModelFormState => ({
    name: m.name,
    provider: m.provider,
    modelId: m.modelId,
    modelType: m.modelType,
    contextWindow: m.limits.contextWindow ? String(m.limits.contextWindow / 1000) + 'k' : '',
    maxOutputTokens: String(m.limits.maxOutputTokens ?? m.parameters.maxOutputTokens ?? '4096'),
    stream: String(m.capabilities.stream ?? m.parameters.stream ?? true),
    jsonMode: String(m.capabilities.jsonMode ?? m.parameters.jsonMode ?? false),
    toolCalling: String(m.capabilities.toolCalling ?? m.parameters.toolCalling ?? false),
    thinkingEnabled: String(m.capabilities.reasoning ?? m.parameters.thinkingEnabled ?? false),
    dimensions: String(m.limits.embeddingDimensions ?? m.parameters.dimensions ?? ''),
  });

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">AI 模型</p>
          <p className="text-xs text-muted-foreground">管理 LLM 和 Embedding 模型，绑定到对应供应商</p>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={providers.length === 0}>
          <Plus className="h-4 w-4" />
          新增模型
        </Button>
      </div>

      {providers.length === 0 && (
        <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm text-muted-foreground">
          请先添加至少一个供应商，才能注册模型。
        </div>
      )}

      {/* 列表 */}
      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Brain className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无模型，请添加</p>
          {providers.length > 0 && <Button size="sm" onClick={handleAdd}>新增模型</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex items-center gap-4 rounded-lg border bg-card px-5 py-4 transition-colors',
                m.status === '停用' && 'opacity-60',
              )}
            >
              {/* 名称 + 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{m.modelType}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {m.providerName} · {PROTOCOL_META[m.protocol]}
                </p>
              </div>

              {/* 能力标签 */}
              <div className="hidden md:flex items-center gap-1 shrink-0">
                {m.capabilities.stream && <Badge variant="secondary" className="text-[10px]">流式</Badge>}
                {m.capabilities.toolCalling && <Badge variant="secondary" className="text-[10px]">工具</Badge>}
                {m.capabilities.reasoning && <Badge variant="secondary" className="text-[10px]">思考</Badge>}
                {m.capabilities.embedding && <Badge variant="secondary" className="text-[10px]">向量</Badge>}
              </div>

              {/* 上下文 */}
              <div className="hidden lg:block text-right shrink-0 w-20">
                <p className="text-xs font-mono text-muted-foreground">
                  {formatTokenDisplay(m.limits.contextWindow ?? m.limits.maxInputTokens)}
                </p>
                <p className="text-[10px] text-muted-foreground">上下文</p>
              </div>

              {/* 状态 */}
              <Badge
                variant={m.status === '启用' ? 'default' : 'secondary'}
                className={cn('shrink-0 w-12 justify-center', m.status === '启用' && 'bg-emerald-500 hover:bg-emerald-500/90')}
              >
                {m.status}
              </Badge>

              {/* 操作 */}
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon-sm" variant="ghost" title="测试连接" onClick={() => void onTest(m)}>
                  <Zap className="h-4 w-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" title="编辑" onClick={() => handleEdit(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" title={m.status === '启用' ? '停用' : '启用'} onClick={() => void onToggleStatus(m)}>
                  {m.status === '启用' ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
                <PopoverConfirm
                  title="删除模型"
                  description={`确认删除「${m.name}」？关联引用该模型的应用将无法调用。`}
                  onConfirm={() => void onDelete(m)}
                >
                  <Button size="icon-sm" variant="ghost" title="删除" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </PopoverConfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 弹窗 */}
      <ModelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providers={providers}
        initialForm={editingModel ? buildInitialForm(editingModel) : undefined}
        onSave={(form, provider) => onSave(form, provider, editingModel?.id)}
        title={editingModel ? '编辑模型' : '新增模型'}
      />
    </div>
  );
}
