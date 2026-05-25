/**
 * 预置用例 — 类型定义
 * @author Antigravity/Gemini
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type StatusLabel = '启用' | '停用';

export interface PresetCategory {
  id: string;
  name: string;
  description: string;
  sortOrder: string;
  status: StatusLabel;
}

export interface PresetCase {
  id: string;
  name: string;
  categoryId: string;
  risk: RiskLevel;
  input: string;
  expected: string;
  status: StatusLabel;
}
