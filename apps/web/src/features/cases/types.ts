/**
 * 预置用例 — 类型定义
 * @author Antigravity/Gemini
 * @author codex
 */
type StatusLabel = '启用' | '停用';

export interface PresetCategory {
  id: string;
  name: string;
  description: string;
  sortOrder: string;
  status: StatusLabel;
}

export interface PresetCase {
  id: string;
  categoryId: string;
  input: string;
  expected: string;
  status: StatusLabel;
}
