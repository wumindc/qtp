import { hashPassword } from '@ai-quality-platform/shared-auth';
import { createPrismaClient } from './client';

/**
 * @author qtp
 * 北极星演示数据：同一多轮用例在基线版本通过、候选版本第 3 轮使用旧值退化。
 * 零配置可跑：pnpm db:push && pnpm db:seed。
 */

const J = (v: unknown) => JSON.stringify(v);

async function main() {
  const prisma = createPrismaClient();

  // —— 幂等：清空业务表后重建 ——
  await prisma.review.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.assertionResult.deleteMany();
  await prisma.caseResult.deleteMany();
  await prisma.comparison.deleteMany();
  await prisma.regressionRun.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.appVersion.deleteMany();
  await prisma.app.deleteMany();

  // —— 管理员 ——
  const adminPassword = process.env.QTP_ADMIN_INITIAL_PASSWORD ?? 'admin123';
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      displayName: '系统管理员',
      passwordHash: hashPassword(adminPassword),
      roleCode: 'ADMIN',
    },
  });

  // —— 应用与版本 ——
  const appCode = 'smart-customer-service';
  await prisma.app.create({
    data: {
      appCode,
      appName: '智能客服助手',
      appType: 'CHAT',
      invokeUrl: 'https://api.example.com/v1/chat/completions',
      owner: 'admin',
      status: 'ENABLED',
    },
  });
  await prisma.appVersion.createMany({
    data: [
      {
        appCode,
        versionCode: 'v1.4.0',
        versionType: 'BASELINE',
        promptVersion: 'prompt@1.4',
        modelVersion: 'qwen-plus',
        commitId: 'a1b2c3d',
        changeNote: '当前生产版本',
        createdBy: 'admin',
      },
      {
        appCode,
        versionCode: 'v1.5.0-rc1',
        versionType: 'CANDIDATE',
        promptVersion: 'prompt@1.5',
        modelVersion: 'qwen-plus',
        commitId: 'e4f5g6h',
        changeNote: '精简系统提示，压缩上下文携带',
        createdBy: 'admin',
      },
    ],
  });

  // —— 用例 ——
  const staleCase = await prisma.testCase.create({
    data: {
      appCode,
      name: '员工数变更后的小微企业认定',
      caseType: 'MULTI_TURN',
      riskLevel: 'HIGH',
      priority: 'P0',
      source: 'SESSION',
      tags: J(['多轮对话', '上下文更新', '高价值']),
      turnsSpec: J([
        { turnIndex: 1, userInput: '我们公司有 80 名员工。', expect: { mustRecognize: { employee_count: 80 } } },
        {
          turnIndex: 2,
          userInput: '不对，最近调整为 20 人了。',
          expect: { mustUpdateContext: { employee_count: 20 }, mustNotUseStaleContext: { employee_count: 80 } },
        },
        {
          turnIndex: 3,
          userInput: '那我们符合小微企业认定吗？',
          expect: {
            mustNotUseStaleContext: { employee_count: 80 },
            mustContain: ['20'],
            mustNotContain: ['80'],
          },
        },
      ]),
    },
  });
  const refundCase = await prisma.testCase.create({
    data: {
      appCode,
      name: '退款政策多轮追问',
      caseType: 'MULTI_TURN',
      riskLevel: 'MEDIUM',
      priority: 'P1',
      source: 'SESSION',
      tags: J(['多轮对话', '政策咨询']),
      turnsSpec: J([
        { turnIndex: 1, userInput: '你们支持七天无理由退款吗？', expect: { mustContain: ['七天', '无理由'] } },
        { turnIndex: 2, userInput: '那定制商品也可以吗？', expect: { mustContain: ['定制'] } },
      ]),
    },
  });
  const invoiceCase = await prisma.testCase.create({
    data: {
      appCode,
      name: '发票类型澄清',
      caseType: 'MULTI_TURN',
      riskLevel: 'LOW',
      priority: 'P2',
      source: 'MANUAL',
      tags: J(['多轮对话', '澄清']),
      turnsSpec: J([
        { turnIndex: 1, userInput: '我要开发票。', expect: { mustContain: ['增值税', '普通'] } },
        { turnIndex: 2, userInput: '要专票。', expect: { mustContain: ['专用发票'] } },
      ]),
    },
  });

  // —— 基线执行（v1.4，全部通过）——
  const baselineRun = await prisma.regressionRun.create({
    data: {
      runCode: 'RUN-BASE-0001',
      appCode,
      versionCode: 'v1.4.0',
      role: 'BASELINE',
      status: 'COMPLETED',
      totalCount: 3,
      passCount: 3,
      failCount: 0,
      startedAt: new Date('2026-05-29T02:00:00Z'),
      finishedAt: new Date('2026-05-29T02:03:00Z'),
    },
  });

  await prisma.caseResult.create({
    data: {
      runCode: baselineRun.runCode,
      caseId: staleCase.id,
      appCode,
      passStatus: 'PASS',
      riskLevel: 'HIGH',
      latencyMs: 1040,
      turnsActual: J([
        { turnIndex: 1, userInput: '我们公司有 80 名员工。', answer: '好的，已记录贵公司员工人数为 80 人。', latencyMs: 820, status: 'success' },
        { turnIndex: 2, userInput: '不对，最近调整为 20 人了。', answer: '已更新，贵公司当前员工人数为 20 人。', latencyMs: 910, status: 'success' },
        {
          turnIndex: 3,
          userInput: '那我们符合小微企业认定吗？',
          answer: '按贵公司最新的 20 名员工计算，符合小微企业的从业人数标准。',
          latencyMs: 1040,
          status: 'success',
          highlights: [{ start: 8, end: 10, kind: 'fresh' }],
        },
      ]),
    },
  });
  await passResult(prisma, baselineRun.runCode, refundCase.id, appCode, 'MEDIUM');
  await passResult(prisma, baselineRun.runCode, invoiceCase.id, appCode, 'LOW');

  // —— 候选执行（v1.5，stale-context 用例退化）——
  const candidateRun = await prisma.regressionRun.create({
    data: {
      runCode: 'RUN-CAND-0001',
      appCode,
      versionCode: 'v1.5.0-rc1',
      role: 'CANDIDATE',
      status: 'COMPLETED',
      totalCount: 3,
      passCount: 2,
      failCount: 1,
      startedAt: new Date('2026-05-29T03:00:00Z'),
      finishedAt: new Date('2026-05-29T03:03:00Z'),
    },
  });

  const failResult = await prisma.caseResult.create({
    data: {
      runCode: candidateRun.runCode,
      caseId: staleCase.id,
      appCode,
      passStatus: 'FAIL',
      failureType: '上下文遗忘',
      riskLevel: 'HIGH',
      latencyMs: 990,
      sampleCount: 5,
      stabilityScore: 0.92,
      regressionVerdict: 'TRUE_REGRESSION',
      regressionConfidence: 0.9,
      turnsActual: J([
        { turnIndex: 1, userInput: '我们公司有 80 名员工。', answer: '好的，已记录贵公司员工人数为 80 人。', latencyMs: 780, status: 'success' },
        { turnIndex: 2, userInput: '不对，最近调整为 20 人了。', answer: '已更新，贵公司当前员工人数为 20 人。', latencyMs: 870, status: 'success' },
        {
          turnIndex: 3,
          userInput: '那我们符合小微企业认定吗？',
          answer: '按贵公司 80 名员工计算，超过小微企业从业人数上限，暂不符合认定标准。',
          latencyMs: 990,
          status: 'success',
          highlights: [{ start: 4, end: 6, kind: 'stale' }],
        },
      ]),
    },
  });
  await prisma.assertionResult.createMany({
    data: [
      {
        resultId: failResult.id,
        turnIndex: 3,
        assertionType: 'mustNotUseStaleContext',
        expression: 'employee_count != 80',
        expectedValue: J({ employee_count: 20 }),
        actualValue: J({ employee_count: 80 }),
        passed: false,
        evidenceSpan: J({ turnIndex: 3, start: 4, end: 6 }),
      },
      {
        resultId: failResult.id,
        turnIndex: 3,
        assertionType: 'mustNotContain',
        expression: 'answer not contains "80"',
        expectedValue: J(['80']),
        actualValue: J('包含 "80"'),
        passed: false,
        evidenceSpan: J({ turnIndex: 3, start: 4, end: 6 }),
      },
      {
        resultId: failResult.id,
        turnIndex: 3,
        assertionType: 'mustContain',
        expression: 'answer contains "20"',
        expectedValue: J(['20']),
        actualValue: J('未包含 "20"'),
        passed: false,
      },
    ],
  });
  await prisma.diagnosis.create({
    data: {
      resultId: failResult.id,
      appCode,
      primaryType: '上下文遗忘',
      conclusion: '候选版本在第 3 轮使用了已被用户更新的旧值（员工数 80）进行判定，导致小微企业认定结论错误。基线版本在相同输入下正确使用了最新值 20。',
      evidence: J([
        { source: 'user', turnIndex: 2, text: '用户在第 2 轮将员工数从 80 更新为 20', span: null },
        { source: 'assistant', turnIndex: 2, text: '候选版本已确认更新为 20', span: null },
        { source: 'assistant', turnIndex: 3, text: '候选版本第 3 轮仍按 80 判定', span: { start: 4, end: 6 } },
      ]),
      possibleCauses: J([
        { name: '上下文更新未持久化', confidenceLevel: '高', note: '多轮记忆未把第 2 轮的新值覆盖到后续推理' },
        { name: '查询改写丢失关键条件', confidenceLevel: '中', note: 'v1.5 精简提示后，改写可能丢弃了最新实体值' },
      ]),
      suggestions: J([
        { text: '在系统提示中明确「始终使用对话中最新的事实信息」' },
        { text: '第 2 轮更新后强制刷新上下文变量 employee_count=20' },
        { text: '为「条件更新后判定」补充多轮回归用例，纳入发布门禁' },
      ]),
      confidence: 0.88,
      generatedBy: 'HYBRID',
    },
  });
  await passResult(prisma, candidateRun.runCode, refundCase.id, appCode, 'MEDIUM');
  await passResult(prisma, candidateRun.runCode, invoiceCase.id, appCode, 'LOW');

  // —— 执行对比 ——
  await prisma.comparison.create({
    data: {
      comparisonCode: 'CMP-0001',
      appCode,
      baselineRunCode: baselineRun.runCode,
      candidateRunCode: candidateRun.runCode,
      baselineVersionCode: 'v1.4.0',
      candidateVersionCode: 'v1.5.0-rc1',
      status: 'COMPLETED',
      releaseRecommendation: 'REJECT',
      passRateDelta: -1 / 3,
      newFailCount: 1,
      fixedFailCount: 0,
      persistentFailCount: 0,
      stabilityScore: 0.92,
      avgLatencyDeltaMs: -40,
      summary: J({
        degradationByType: { 上下文遗忘: 1 },
        versionChange: ['Prompt 由 prompt@1.4 升级到 prompt@1.5（精简系统提示）'],
        note: '存在 1 个高风险新增失败（上下文遗忘），不建议发布。',
      }),
    },
  });

  await prisma.$disconnect();
  console.log('✓ 北极星演示数据已写入（应用 / 版本 / 多轮用例 / 基线&候选执行 / 断言 / 诊断 / 对比）');
}

async function passResult(
  prisma: ReturnType<typeof createPrismaClient>,
  runCode: string,
  caseId: number,
  appCode: string,
  riskLevel: string,
) {
  await prisma.caseResult.create({
    data: {
      runCode,
      caseId,
      appCode,
      passStatus: 'PASS',
      riskLevel,
      latencyMs: 900,
      turnsActual: J([
        { turnIndex: 1, userInput: '（见用例脚本）', answer: '（符合期望的回答）', latencyMs: 880, status: 'success' },
        { turnIndex: 2, userInput: '（见用例脚本）', answer: '（符合期望的回答）', latencyMs: 900, status: 'success' },
      ]),
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
