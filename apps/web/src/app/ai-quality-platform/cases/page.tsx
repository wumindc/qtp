import { SystemPresetCasesPage } from '../../../features/cases/system-preset-cases-page';
import { loadGatewayRecords } from '../../../features/gateway-server';

export const dynamic = 'force-dynamic';

export default async function CasesPage() {
  const [categoryData, presetCaseData] = await Promise.all([
    loadGatewayRecords('case', '/case/category/list.do'),
    loadGatewayRecords('case', '/case/preset/list.do'),
  ]);

  const categories = categoryData.records.map((item) => ({
    id: String(item.id),
    name: String(item.name ?? '未命名分类'),
    description: String(item.description ?? '未配置说明'),
    sortOrder: String(item.sortOrder ?? '0'),
    status: item.enabled === false || item.status === '停用' ? '停用' : '启用',
  }));
  const presetCases = presetCaseData.records.map((item) => ({
    id: String(item.id ?? item.caseCode ?? item.code),
    name: String(item.caseName ?? item.name ?? '未命名预置用例'),
    categoryId: String(item.categoryId ?? item.categoryCode ?? item.category ?? 'GENERAL'),
    risk: String(item.riskLevel ?? item.risk ?? 'MEDIUM'),
    input: String(item.query ?? item.input ?? '未配置测试输入'),
    expected: String(item.expectedBehavior ?? item.expected ?? '未配置期望行为'),
    status: item.enabled === false || item.status === '停用' ? '停用' : '启用',
  }));

  return (
    <SystemPresetCasesPage
      initialCategories={categories}
      initialCases={presetCases}
      live={categoryData.live || presetCaseData.live}
    />
  );
}
