import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import type { PresetCase, PresetCategory } from '../types';

type GatewayRow = Record<string, unknown>;

function toStringField(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function mapCategory(item: GatewayRow): PresetCategory {
  return {
    id: toStringField(item.id ?? item.code),
    name: toStringField(item.name ?? item.categoryName),
    description: toStringField(item.description),
    sortOrder: toStringField(item.sortOrder, '0'),
    status: item.enabled === false ? '停用' : '启用',
  };
}

function mapCase(item: GatewayRow): PresetCase {
  return {
    id: toStringField(item.id ?? item.caseCode),
    name: toStringField(item.name ?? item.caseName),
    categoryId: toStringField(item.categoryId ?? item.categoryCode),
    risk: (item.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
    input: toStringField(item.input ?? item.query),
    expected: toStringField(item.expectedBehavior),
    status: item.enabled === false ? '停用' : '启用',
  };
}

export async function loadCategories(): Promise<PresetCategory[]> {
  const result = await postGateway<unknown>(
    'case',
    '/case/category/list.do',
    { page: { currentPage: 1, linesPerPage: 100 }, data: {} },
    { cache: 'no-store' }
  );
  return readGatewayList<GatewayRow>(result).map(mapCategory);
}

export async function loadPresetCases(categoryId?: string): Promise<PresetCase[]> {
  const data = categoryId ? { categoryId } : {};
  const result = await postGateway<unknown>(
    'case',
    '/case/preset/list.do',
    { page: { currentPage: 1, linesPerPage: 500 }, data },
    { cache: 'no-store' }
  );
  return readGatewayList<GatewayRow>(result).map(mapCase);
}

export async function saveCategory(category: Partial<PresetCategory>, editingId?: string) {
  const payload = {
    name: category.name?.trim(),
    description: category.description?.trim(),
    sortOrder: Number(category.sortOrder) || 0,
    enabled: category.status !== '停用',
  };
  if (editingId) {
    return postGateway<GatewayRow>('case', '/case/category/update.do', { id: editingId, data: payload });
  }
  return postGateway<GatewayRow>('case', '/case/category/create.do', payload);
}

export async function saveCase(presetCase: Partial<PresetCase>, editingId?: string) {
  const payload = {
    caseName: presetCase.name?.trim(),
    categoryCode: presetCase.categoryId,
    riskLevel: presetCase.risk,
    query: presetCase.input?.trim(),
    expectedBehavior: presetCase.expected?.trim(),
    enabled: presetCase.status !== '停用',
  };
  if (editingId) {
    return postGateway<GatewayRow>('case', '/case/preset/update.do', { id: editingId, data: payload });
  }
  return postGateway<GatewayRow>('case', '/case/preset/create.do', payload);
}

export async function changeCategoryStatus(id: string, enabled: boolean) {
  return postGateway('case', '/case/category/change-enabled.do', { id, enabled });
}

export async function changeCaseStatus(id: string, enabled: boolean) {
  return postGateway('case', '/case/preset/change-enabled.do', { id, enabled });
}

export async function deleteCategory(id: string) {
  return postGateway('case', '/case/category/delete.do', { id });
}

export async function deleteCase(id: string) {
  return postGateway('case', '/case/preset/delete.do', { id });
}
