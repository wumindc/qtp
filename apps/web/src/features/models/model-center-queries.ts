import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeModelStatus,
  changeProviderStatus,
  deleteModel,
  deleteProvider,
  loadModelCenterData,
  saveModel,
  saveProvider,
  testModel,
  testProvider,
  type ModelCenterInitialData,
} from './api/model-center-api';
import type { ModelCenterRecord, ModelFormState, ModelProviderRecord, ProviderFormState } from './types';

export const modelCenterQueryKey = ['model-center'] as const;

export function useModelCenterData(initialData: ModelCenterInitialData) {
  return useQuery({
    queryKey: modelCenterQueryKey,
    queryFn: loadModelCenterData,
    initialData,
  });
}

/**
 * @author codex
 * Centralizes Model Center mutations so the page can refresh one query after changes.
 */
export function useModelCenterMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: modelCenterQueryKey });

  return {
    saveProvider: useMutation({
      mutationFn: ({ form, editingProviderCode }: { form: ProviderFormState; editingProviderCode?: string }) => saveProvider(form, editingProviderCode),
      onSuccess: invalidate,
    }),
    saveModel: useMutation({
      mutationFn: ({ form, provider, editingModelId }: { form: ModelFormState; provider: ModelProviderRecord; editingModelId?: string }) =>
        saveModel(form, provider, editingModelId),
      onSuccess: invalidate,
    }),
    changeModelStatus: useMutation({ mutationFn: (model: ModelCenterRecord) => changeModelStatus(model), onSuccess: invalidate }),
    changeProviderStatus: useMutation({ mutationFn: (provider: ModelProviderRecord) => changeProviderStatus(provider), onSuccess: invalidate }),
    deleteModel: useMutation({ mutationFn: (model: ModelCenterRecord) => deleteModel(model), onSuccess: invalidate }),
    deleteProvider: useMutation({ mutationFn: (provider: ModelProviderRecord) => deleteProvider(provider), onSuccess: invalidate }),
    testModel: useMutation({ mutationFn: (model: ModelCenterRecord) => testModel(model) }),
    testProvider: useMutation({ mutationFn: (provider: ModelProviderRecord) => testProvider(provider) }),
  };
}
