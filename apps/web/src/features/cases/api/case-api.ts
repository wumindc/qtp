/**
 * 预置用例 API 封装
 * @author codex
 */
import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import type { PresetCase, PresetCategory } from '../types';
import type { CaseCsvRow } from '../case-csv';

type GatewayRow = Record<string, unknown>;

function readStringField(value: unknown, message: string) {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function readRequiredStringField(value: unknown, message: string) {
  const text = readStringField(value, message);
  if (!text.trim()) throw new Error(message);
  return text;
}

function readNumberField(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message);
  return value;
}

function readBooleanField(value: unknown, message: string) {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function mapCategory(item: GatewayRow): PresetCategory {
  return {
    id: readRequiredStringField(item.id, '预置分类响应缺少分类 ID'),
    name: readRequiredStringField(item.name, '预置分类响应缺少分类名称'),
    description: readStringField(item.description, '预置分类响应缺少分类描述'),
    sortOrder: String(readNumberField(item.sortOrder, '预置分类响应缺少排序值')),
    status: readBooleanField(item.enabled, '预置分类响应缺少启停状态') ? '启用' : '停用',
  };
}

function mapCase(item: GatewayRow): PresetCase {
  return {
    id: readRequiredStringField(item.id, '预置用例响应缺少用例 ID'),
    categoryId: readRequiredStringField(item.categoryId, '预置用例响应缺少分类 ID'),
    input: readRequiredStringField(item.query, '预置用例响应缺少问题内容'),
    expected: readRequiredStringField(item.expectedBehavior, '预置用例响应缺少期望回答'),
    status: readBooleanField(item.enabled, '预置用例响应缺少启停状态') ? '启用' : '停用',
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
    categoryId: presetCase.categoryId,
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

export async function importCaseCsvRows(scope: 'APP' | 'SYSTEM_PRESET', rows: CaseCsvRow[], appCode?: string) {
  return postGateway('case', '/case/import-csv.do', {
    scope,
    appCode,
    rows,
  });
}
