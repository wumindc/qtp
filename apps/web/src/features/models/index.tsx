'use client';
/**
 * 模型中心 — 主页面（供应商 + 模型两个标签页）
 * @author Antigravity/Gemini
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getErrorMessage } from '@/lib/error';
import { ProvidersPanel } from './providers-panel';
import { ModelsPanel } from './models-panel';
import {
  loadModelCenterData,
  saveProvider,
  saveModel,
  changeProviderStatus,
  changeModelStatus,
  deleteProvider,
  deleteModel,
  testProvider,
  testModel,
} from './api/model-center-api';
import type { ModelCenterRecord, ModelFormState, ModelProviderRecord, ProviderFormState } from './types';

interface ModelCenterPageProps {
  initialModels?: ModelCenterRecord[];
  initialProviders?: ModelProviderRecord[];
}

export function ModelCenterPage({ initialModels, initialProviders }: ModelCenterPageProps) {
  const [models, setModels] = useState<ModelCenterRecord[]>(initialModels ?? []);
  const [providers, setProviders] = useState<ModelProviderRecord[]>(initialProviders ?? []);
  const [loading, setLoading] = useState(!initialModels || !initialProviders);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await loadModelCenterData();
      setModels(data.models);
      setProviders(data.providers);
    } catch (error: unknown) {
      const message = getErrorMessage(error, '模型中心加载失败');
      setLoadError(message);
      toast.error(`模型中心加载失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialModels || !initialProviders) {
      void refresh();
    }
  }, [initialModels, initialProviders, refresh]);

  /* ── 供应商操作 ── */
  const handleSaveProvider = async (form: ProviderFormState, editingCode?: string) => {
    await saveProvider(form, editingCode);
    toast.success(editingCode ? '供应商已更新' : '供应商已创建');
    await refresh();
  };

  const handleToggleProvider = async (p: ModelProviderRecord) => {
    await changeProviderStatus(p);
    toast.success(p.status === '启用' ? `已停用 ${p.name}` : `已启用 ${p.name}`);
    await refresh();
  };

  const handleDeleteProvider = async (p: ModelProviderRecord) => {
    await deleteProvider(p);
    toast.success(`已删除供应商 ${p.name}`);
    await refresh();
  };

  const handleTestProvider = async (p: ModelProviderRecord) => {
    try {
      const res = await testProvider(p);
      toast.success(res.message ?? '连接测试通过');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '连接测试失败');
    }
  };

  /* ── 模型操作 ── */
  const handleSaveModel = async (form: ModelFormState, provider: ModelProviderRecord, editingId?: string) => {
    await saveModel(form, provider, editingId);
    toast.success(editingId ? '模型已更新' : '模型已创建');
    await refresh();
  };

  const handleToggleModel = async (m: ModelCenterRecord) => {
    await changeModelStatus(m);
    toast.success(m.status === '启用' ? `已停用 ${m.name}` : `已启用 ${m.name}`);
    await refresh();
  };

  const handleDeleteModel = async (m: ModelCenterRecord) => {
    await deleteModel(m);
    toast.success(`已删除模型 ${m.name}`);
    await refresh();
  };

  const handleTestModel = async (m: ModelCenterRecord) => {
    try {
      const res = await testModel(m);
      toast.success(res.message ?? '模型连接测试通过');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '模型连接测试失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">模型中心</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理 AI 供应商和模型，支持 LLM 与 Embedding 分离配置。
        </p>
      </div>

      {/* 统计 */}
      {loadError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4">
          <p className="text-sm font-semibold text-destructive">模型中心加载失败</p>
          <p className="mt-1 text-xs text-destructive/80">{loadError}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '供应商', value: providers.length },
          { label: '启用供应商', value: providers.filter((p) => p.status === '启用').length },
          { label: '模型', value: models.length },
          { label: '启用模型', value: models.filter((m) => m.status === '启用').length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card px-5 py-4 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="models">
        <TabsList>
          <TabsTrigger value="models">模型（{models.length}）</TabsTrigger>
          <TabsTrigger value="providers">供应商（{providers.length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-4">
          <ModelsPanel
            models={models}
            providers={providers}
            onSave={handleSaveModel}
            onToggleStatus={handleToggleModel}
            onDelete={handleDeleteModel}
            onTest={handleTestModel}
          />
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <ProvidersPanel
            providers={providers}
            onSave={handleSaveProvider}
            onToggleStatus={handleToggleProvider}
            onDelete={handleDeleteProvider}
            onTest={handleTestProvider}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
