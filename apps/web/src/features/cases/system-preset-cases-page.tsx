'use client';

import { FormEvent, useMemo, useState } from 'react';
import { getGatewayApiUrl } from '@ai-quality-platform/shared-config';
import type { ManagementConsoleRecord } from '../management-console-page';
import { ConsoleSelect, DialogContent, DialogRoot, TextArea, TextInput } from '@/components/ui';

interface PresetCategory extends ManagementConsoleRecord {
  name: string;
  description: string;
  sortOrder: string;
}

interface PresetCase extends ManagementConsoleRecord {
  name: string;
  categoryId: string;
  risk: string;
  input: string;
  expected: string;
}

interface PresetCasesPageProps {
  initialCategories: PresetCategory[];
  initialCases: PresetCase[];
  live: boolean;
}

type Notice = { type: 'success' | 'warning'; text: string };
type PresetAdminTab = 'cases' | 'categories';

const ALL_CATEGORY = 'ALL';
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * @author codex
 * Provides global system preset case management for categories and reusable preset cases.
 */
export function SystemPresetCasesPage({ initialCategories, initialCases, live }: PresetCasesPageProps) {
  const [categories, setCategories] = useState<PresetCategory[]>(initialCategories);
  const [presetCases, setPresetCases] = useState<PresetCase[]>(initialCases);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeTab, setActiveTab] = useState<PresetAdminTab>('cases');
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORY);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', description: '' });
  const [caseDraft, setCaseDraft] = useState({
    name: '',
    categoryId: initialCategories[0]?.id ?? '',
    risk: 'MEDIUM',
    input: '',
    expected: '',
  });

  const categoryCounts = useMemo(() => {
    const counts = new Map(categories.map((category) => [category.id, 0]));
    presetCases.forEach((testCase) => {
      counts.set(testCase.categoryId, (counts.get(testCase.categoryId) ?? 0) + 1);
    });
    return counts;
  }, [categories, presetCases]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const isAllCategorySelected = selectedCategoryId === ALL_CATEGORY;

  const categoryCases = useMemo(() => {
    if (isAllCategorySelected) return presetCases;
    return presetCases.filter((testCase) => testCase.categoryId === selectedCategoryId);
  }, [isAllCategorySelected, presetCases, selectedCategoryId]);

  const visibleCases = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return categoryCases.filter((testCase) => {
      if (!keyword) return true;
      return Object.values(testCase).join(' ').toLowerCase().includes(keyword);
    });
  }, [categoryCases, query]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const postAction = async (path: string, payload: Record<string, unknown>) => {
    const response = await fetch(getGatewayApiUrl('case', path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.message ?? '服务端暂未确认操作结果');
    }
    return result.data ?? result;
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCategory: PresetCategory = {
      id: `local_category_${Date.now()}`,
      name: categoryDraft.name,
      description: categoryDraft.description,
      sortOrder: String((categories.length + 1) * 10),
      status: '启用',
    };
    try {
      const saved = await postAction('/case/category/create.do', {
        name: nextCategory.name,
        description: nextCategory.description,
      });
      nextCategory.id = String(saved.id ?? nextCategory.id);
      setNotice({ type: 'success', text: '分类已保存到系统预置用例库。' });
      setCategories((current) => [nextCategory, ...current]);
      setCaseDraft((current) => ({ ...current, categoryId: nextCategory.id }));
      setSelectedCategoryId(nextCategory.id);
      setCategoryDraft({ name: '', description: '' });
      setCategoryModalOpen(false);
    } catch (error) {
      setNotice({ type: 'warning', text: error instanceof Error ? error.message : '分类暂未保存成功。' });
    }
  };

  const createPresetCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCase: PresetCase = {
      id: `local_case_${Date.now()}`,
      name: caseDraft.name,
      categoryId: caseDraft.categoryId,
      risk: caseDraft.risk,
      input: caseDraft.input,
      expected: caseDraft.expected,
      status: '启用',
    };
    try {
      const saved = await postAction('/case/preset/create.do', {
        caseName: nextCase.name,
        appCode: 'SYSTEM_PRESET',
        categoryId: nextCase.categoryId,
        riskLevel: nextCase.risk,
        query: nextCase.input,
        expectedBehavior: nextCase.expected,
      });
      nextCase.id = String(saved.id ?? nextCase.id);
      setNotice({ type: 'success', text: '系统预置测试用例已保存。' });
      setPresetCases((current) => [nextCase, ...current]);
      setSelectedCategoryId(nextCase.categoryId);
      setCaseDraft({
        name: '',
        categoryId: categories[0]?.id ?? '',
        risk: 'MEDIUM',
        input: '',
        expected: '',
      });
      setCaseModalOpen(false);
    } catch (error) {
      setNotice({ type: 'warning', text: error instanceof Error ? error.message : '预置测试用例暂未保存成功。' });
    }
  };

  const togglePresetCase = async (testCase: PresetCase) => {
    const enabled = testCase.status !== '启用';
    try {
      await postAction('/case/preset/change-enabled.do', { id: testCase.id, enabled });
      setPresetCases((current) =>
        current.map((item) => (item.id === testCase.id ? { ...item, status: enabled ? '启用' : '停用' } : item)),
      );
      setNotice({ type: 'success', text: enabled ? '预置测试用例已启用。' : '预置测试用例已停用。' });
    } catch (error) {
      setNotice({ type: 'warning', text: error instanceof Error ? error.message : '状态暂未更新成功。' });
    }
  };

  return (
    <section className="preset-admin-page">
      <header className="console-heading">
        <div>
          <h1>系统预置测试用例</h1>
          <p>全局维护平台可复用的测试分类和预置测试用例，应用内只能引用，不在这里绑定具体应用。</p>
        </div>
        <span className="console-soft-badge">{live ? '服务端数据' : '加载失败'}</span>
      </header>

      {notice ? <div className={`app-action-message is-${notice.type}`}>{notice.text}</div> : null}

      <div className="preset-admin-tabs" role="tablist" aria-label="系统预置测试用例管理">
        <button
          aria-selected={activeTab === 'cases'}
          className={activeTab === 'cases' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('cases')}
        >
          用例列表
          <span>{presetCases.length}</span>
        </button>
        <button
          aria-selected={activeTab === 'categories'}
          className={activeTab === 'categories' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('categories')}
        >
          分类列表
          <span>{categories.length}</span>
        </button>
      </div>

      {activeTab === 'cases' ? (
        <section className="app-detail-section preset-admin-panel" role="tabpanel">
          <div className="preset-case-browser">
            <aside className="preset-category-rail" aria-label="预置用例分类">
              <div className="preset-category-rail-header">
                <strong>测试用例分类</strong>
                <span>{presetCases.length} 条用例</span>
              </div>
              <div className="preset-category-list">
                <button
                  aria-pressed={selectedCategoryId === ALL_CATEGORY}
                  className={selectedCategoryId === ALL_CATEGORY ? 'is-active' : ''}
                  type="button"
                  onClick={() => setSelectedCategoryId(ALL_CATEGORY)}
                >
                  <span>
                    <strong>全部用例</strong>
                    <small>查看所有系统预置用例</small>
                  </span>
                  <em>{presetCases.length}</em>
                </button>
                {categories.map((category) => (
                  <button
                    aria-pressed={selectedCategoryId === category.id}
                    className={selectedCategoryId === category.id ? 'is-active' : ''}
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.description}</small>
                    </span>
                    <em>{categoryCounts.get(category.id) ?? 0}</em>
                  </button>
                ))}
              </div>
            </aside>

            <div className="preset-case-content">
              <div className="preset-admin-toolbar preset-case-toolbar">
                <div className="preset-case-heading">
                  <strong>{selectedCategory?.name ?? '全部用例'}</strong>
                  <span>
                    共 {categoryCases.length} 条，用于平台全局复用
                    {selectedCategory ? ` · ${selectedCategory.description}` : ''}
                  </span>
                </div>
                <TextInput
                  aria-label="搜索预置用例"
                  className="console-search"
                  placeholder="搜索名称、分类或期望行为"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button className="console-button console-button-primary" type="button" disabled={categories.length === 0} onClick={() => setCaseModalOpen(true)}>
                  新增预置用例
                </button>
              </div>

              <div className="console-table-wrap preset-admin-table-wrap">
                <table className={`console-table preset-admin-table app-case-table ${isAllCategorySelected ? 'is-all-categories' : 'is-category-scoped'}`}>
                  <thead>
                    <tr>
                      <th>用例名称</th>
                      {isAllCategorySelected ? <th>分类</th> : null}
                      <th>风险</th>
                      <th>期望行为</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCases.map((testCase) => (
                      <tr key={testCase.id}>
                        <td>
                          <strong>{testCase.name}</strong>
                          <small>{testCase.input}</small>
                        </td>
                        {isAllCategorySelected ? <td>{categoryNameById.get(testCase.categoryId) ?? '未归类'}</td> : null}
                        <td>
                          <span className={`app-case-risk is-${testCase.risk.toLowerCase()}`}>{testCase.risk}</span>
                        </td>
                        <td>{testCase.expected}</td>
                        <td>
                          <span className={`console-status-pill console-status-${testCase.status}`}>{testCase.status}</span>
                        </td>
                        <td>
                          <button className="console-button" type="button" onClick={() => void togglePresetCase(testCase)}>
                            {testCase.status === '启用' ? '停用' : '启用'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleCases.length === 0 ? (
                  <div className="preset-case-empty">
                    <strong>{query.trim() ? '没有匹配的预置用例' : '当前分类暂无预置用例'}</strong>
                    <span>{categories.length === 0 ? '请先创建分类，再维护平台级预置用例。' : '这里保持数据库真实空态，不展示本地示例数据。'}</span>
                    <button className="console-button" type="button" onClick={() => (categories.length === 0 ? setCategoryModalOpen(true) : setCaseModalOpen(true))}>
                      {categories.length === 0 ? '新增分类' : '新增预置用例'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'categories' ? (
        <section className="app-detail-section preset-admin-panel" role="tabpanel">
          <div className="preset-admin-toolbar">
            <div className="preset-admin-toolbar-copy">
              <strong>分类定义</strong>
              <span>预置用例会按分类归档，应用引用时保留分类信息。</span>
            </div>
            <button className="console-button console-button-primary" type="button" onClick={() => setCategoryModalOpen(true)}>
              新增分类
            </button>
          </div>

          <div className="console-table-wrap preset-admin-table-wrap">
            <table className="console-table preset-admin-table">
              <thead>
                <tr>
                  <th>分类名称</th>
                  <th>分类说明</th>
                  <th>排序</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.description}</td>
                    <td>{category.sortOrder}</td>
                    <td>
                      <span className={`console-status-pill console-status-${category.status}`}>{category.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 ? (
              <div className="preset-case-empty">
                <strong>当前暂无分类</strong>
                <span>预置用例按分类归档，空库时仅展示真实空态。</span>
                <button className="console-button" type="button" onClick={() => setCategoryModalOpen(true)}>
                  新增分类
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <DialogRoot open={caseModalOpen} onOpenChange={setCaseModalOpen}>
        {caseModalOpen ? (
          <DialogContent className="preset-admin-modal" description="维护平台级可复用测试用例，应用内只引用这些用例。" title="新增预置用例">
          <form className="console-dialog-form" aria-label="新增预置用例表单" onSubmit={createPresetCase}>
            <p className="console-dialog-form-note">维护平台级可复用测试用例</p>
            <div className="console-form-grid">
              <TextInput className="console-form-field" label="用例名称" required value={caseDraft.name} onChange={(event) => setCaseDraft({ ...caseDraft, name: event.target.value })} />
              <label className="console-form-field">
                <span>分类</span>
                <ConsoleSelect
                  value={caseDraft.categoryId}
                  onValueChange={(value) => setCaseDraft({ ...caseDraft, categoryId: value })}
                  placeholder="请选择分类"
                  options={categories.map((category) => ({ label: category.name, value: category.id }))}
                />
              </label>
              <label className="console-form-field">
                <span>风险等级</span>
                <ConsoleSelect
                  value={caseDraft.risk}
                  onValueChange={(value) => setCaseDraft({ ...caseDraft, risk: value })}
                  options={RISK_LEVELS.map((risk) => ({ label: risk, value: risk }))}
                />
              </label>
              <TextArea className="console-form-field is-wide" label="测试输入" required value={caseDraft.input} onChange={(event) => setCaseDraft({ ...caseDraft, input: event.target.value })} />
              <TextArea className="console-form-field is-wide" label="期望行为" required value={caseDraft.expected} onChange={(event) => setCaseDraft({ ...caseDraft, expected: event.target.value })} />
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={() => setCaseModalOpen(false)}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                保存预置用例
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>

      <DialogRoot open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        {categoryModalOpen ? (
          <DialogContent className="preset-admin-modal preset-admin-category-modal" description="定义系统预置用例分类，用于全局归档和应用引用。" title="新增分类">
          <form className="console-dialog-form" aria-label="新增分类表单" onSubmit={createCategory}>
            <p className="console-dialog-form-note">定义系统预置用例分类</p>
            <div className="console-form-grid">
              <TextInput className="console-form-field" label="分类名称" required value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} />
              <TextArea className="console-form-field is-wide" label="分类说明" required value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} />
            </div>
            <div className="console-modal-actions">
              <button className="console-button" type="button" onClick={() => setCategoryModalOpen(false)}>
                取消
              </button>
              <button className="console-button console-button-primary" type="submit">
                保存分类
              </button>
            </div>
          </form>
          </DialogContent>
        ) : null}
      </DialogRoot>
    </section>
  );
}
