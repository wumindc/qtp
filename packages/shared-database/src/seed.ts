import { hashPassword } from '@ai-quality-platform/shared-auth';
import {
  evaluateCase,
  evaluateStability,
  runRegression,
  aggregateComparison,
  type TurnSpec,
  type TurnActual,
  type RunnableCase,
  type CaseOutcome,
} from '@ai-quality-platform/eval-engine';
import { createPrismaClient } from './client';

/**
 * @author qtp
 * 北极星演示数据：同一多轮用例在基线版本通过、候选版本第 3 轮使用旧值退化。
 * 断言结果 / 逐轮高亮 / 稳定性判定全部由 eval-engine 计算，而非手写——
 * 这意味着演示数据是「真实评估出来的」，不是剧本。
 * 零配置可跑：pnpm db:push && pnpm db:seed。
 */

const J = (v: unknown) => JSON.stringify(v);

interface CaseDef {
  name: string;
  riskLevel: string;
  priority: string;
  source: string;
  tags: string[];
  spec: TurnSpec[];
  baseline: TurnActual[];
  candidate: TurnActual[];
  /** 候选侧多次采样的通过序列（驱动稳定性判定）；省略则不做稳定性分析 */
  candidateSamples?: boolean[];
  /** 候选失败时的诊断叙事（结论/证据/原因/建议）——引擎给事实，这里给解读 */
  diagnosis?: {
    conclusion: string;
    evidence: { source: string; turnIndex: number; text: string; span: unknown }[];
    possibleCauses: { name: string; confidenceLevel: string; note: string }[];
    suggestions: { text: string }[];
    confidence: number;
    generatedBy: string;
  };
}

const CASES: CaseDef[] = [
  {
    name: '员工数变更后的小微企业认定',
    riskLevel: 'HIGH',
    priority: 'P0',
    source: 'SESSION',
    tags: ['多轮对话', '上下文更新', '高价值'],
    spec: [
      { turnIndex: 1, userInput: '我们公司有 80 名员工。', expect: { mustRecognize: { employee_count: 80 } } },
      { turnIndex: 2, userInput: '不对，最近调整为 20 人了。', expect: { mustUpdateContext: { employee_count: 20 }, mustNotUseStaleContext: { employee_count: 80 } } },
      { turnIndex: 3, userInput: '那我们符合小微企业认定吗？', expect: { mustNotUseStaleContext: { employee_count: 80 }, mustContain: ['20'], mustNotContain: ['80'] } },
    ],
    baseline: [
      { turnIndex: 1, answer: '好的，已记录贵公司员工人数为 80 人。', latencyMs: 820 },
      { turnIndex: 2, answer: '已更新，贵公司当前员工人数为 20 人。', latencyMs: 910 },
      { turnIndex: 3, answer: '按贵公司最新的 20 名员工计算，符合小微企业的从业人数标准。', latencyMs: 1040 },
    ],
    candidate: [
      { turnIndex: 1, answer: '好的，已记录贵公司员工人数为 80 人。', latencyMs: 780 },
      { turnIndex: 2, answer: '已更新，贵公司当前员工人数为 20 人。', latencyMs: 870 },
      { turnIndex: 3, answer: '按贵公司 80 名员工计算，超过小微企业从业人数上限，暂不符合认定标准。', latencyMs: 990 },
    ],
    candidateSamples: [false, false, false, false, true],
    diagnosis: {
      conclusion: '候选版本在第 3 轮使用了已被用户更新的旧值（员工数 80）进行判定，导致小微企业认定结论错误。基线版本在相同输入下正确使用了最新值 20。',
      evidence: [
        { source: 'user', turnIndex: 2, text: '用户在第 2 轮将员工数从 80 更新为 20', span: null },
        { source: 'assistant', turnIndex: 2, text: '候选版本已确认更新为 20', span: null },
        { source: 'assistant', turnIndex: 3, text: '候选版本第 3 轮仍按 80 判定', span: null },
      ],
      possibleCauses: [
        { name: '上下文更新未持久化', confidenceLevel: '高', note: '多轮记忆未把第 2 轮的新值覆盖到后续推理' },
        { name: '查询改写丢失关键条件', confidenceLevel: '中', note: 'v1.5 精简提示后，改写可能丢弃了最新实体值' },
      ],
      suggestions: [
        { text: '在系统提示中明确「始终使用对话中最新的事实信息」' },
        { text: '第 2 轮更新后强制刷新上下文变量 employee_count=20' },
        { text: '为「条件更新后判定」补充多轮回归用例，纳入发布门禁' },
      ],
      confidence: 0.88,
      generatedBy: 'HYBRID',
    },
  },
  {
    name: '退款政策多轮追问',
    riskLevel: 'MEDIUM',
    priority: 'P1',
    source: 'SESSION',
    tags: ['多轮对话', '政策咨询'],
    spec: [
      { turnIndex: 1, userInput: '你们支持七天无理由退款吗？', expect: { mustContain: ['七天', '无理由'] } },
      { turnIndex: 2, userInput: '那定制商品也可以吗？', expect: { mustContain: ['定制'] } },
    ],
    baseline: [
      { turnIndex: 1, answer: '支持，我们提供七天无理由退款。', latencyMs: 760 },
      { turnIndex: 2, answer: '定制商品因个性化生产，不适用七天无理由退款。', latencyMs: 880 },
    ],
    candidate: [
      { turnIndex: 1, answer: '支持，我们提供七天无理由退款。', latencyMs: 740 },
      { turnIndex: 2, answer: '定制商品因个性化生产，不适用七天无理由退款。', latencyMs: 860 },
    ],
  },
  {
    name: '发票类型澄清',
    riskLevel: 'LOW',
    priority: 'P2',
    source: 'MANUAL',
    tags: ['多轮对话', '澄清'],
    spec: [
      { turnIndex: 1, userInput: '我要开发票。', expect: { mustContain: ['增值税', '普通'] } },
      { turnIndex: 2, userInput: '要专票。', expect: { mustContain: ['专用发票'] } },
    ],
    baseline: [
      { turnIndex: 1, answer: '可以开具增值税普通发票或专用发票，请问需要哪种？', latencyMs: 700 },
      { turnIndex: 2, answer: '好的，将为您开具增值税专用发票，请提供开票信息。', latencyMs: 820 },
    ],
    candidate: [
      { turnIndex: 1, answer: '可以开具增值税普通发票或专用发票，请问需要哪种？', latencyMs: 690 },
      { turnIndex: 2, answer: '好的，将为您开具增值税专用发票，请提供开票信息。', latencyMs: 810 },
    ],
  },
];

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
    create: { username: 'admin', displayName: '系统管理员', passwordHash: hashPassword(adminPassword), roleCode: 'ADMIN' },
  });

  // —— 应用与版本 ——
  const appCode = 'smart-customer-service';
  await prisma.app.create({
    data: { appCode, appName: '智能客服助手', appType: 'CHAT', invokeUrl: 'https://api.example.com/v1/chat/completions', owner: 'admin', status: 'ENABLED' },
  });
  await prisma.appVersion.createMany({
    data: [
      { appCode, versionCode: 'v1.4.0', versionType: 'BASELINE', promptVersion: 'prompt@1.4', modelVersion: 'qwen-plus', commitId: 'a1b2c3d', changeNote: '当前生产版本', createdBy: 'admin' },
      { appCode, versionCode: 'v1.5.0-rc1', versionType: 'CANDIDATE', promptVersion: 'prompt@1.5', modelVersion: 'qwen-plus', commitId: 'e4f5g6h', changeNote: '精简系统提示，压缩上下文携带', createdBy: 'admin' },
    ],
  });

  const baselineRun = await prisma.regressionRun.create({
    data: { runCode: 'RUN-BASE-0001', appCode, versionCode: 'v1.4.0', role: 'BASELINE', status: 'COMPLETED', startedAt: new Date('2026-05-29T02:00:00Z'), finishedAt: new Date('2026-05-29T02:03:00Z') },
  });
  const candidateRun = await prisma.regressionRun.create({
    data: { runCode: 'RUN-CAND-0001', appCode, versionCode: 'v1.5.0-rc1', role: 'CANDIDATE', status: 'COMPLETED', startedAt: new Date('2026-05-29T03:00:00Z'), finishedAt: new Date('2026-05-29T03:03:00Z') },
  });

  // 建用例并组装可运行集合
  const runnable: (RunnableCase & { def: CaseDef })[] = [];
  for (const def of CASES) {
    const tc = await prisma.testCase.create({
      data: {
        appCode,
        name: def.name,
        caseType: 'MULTI_TURN',
        riskLevel: def.riskLevel,
        priority: def.priority,
        source: def.source,
        tags: J(def.tags),
        turnsSpec: J(def.spec),
      },
    });
    runnable.push({ caseId: tc.id, spec: def.spec, def });
  }
  const defById = new Map(runnable.map((r) => [r.caseId, r.def]));

  // 用运行器跑两版（provider 返回预置回答；真实 Adapter 将来实现同一接口即可接入）
  const baseResults = await runRegression(runnable, (c) => defById.get(c.caseId)!.baseline);
  const candResults = await runRegression(runnable, (c) => defById.get(c.caseId)!.candidate);
  const baseEvalById = new Map(baseResults.map((r) => [r.caseId, r.evaluation]));

  // 写基线结果
  for (const r of baseResults) {
    await writeResult(prisma, baselineRun.runCode, r.caseId, appCode, defById.get(r.caseId)!.riskLevel, r.evaluation);
  }

  // 写候选结果（含稳定性 + 诊断），并组装对比 outcomes
  const outcomes: CaseOutcome[] = [];
  for (const r of candResults) {
    const def = defById.get(r.caseId)!;
    const baseEval = baseEvalById.get(r.caseId)!;
    const baselinePass = baseEval.passStatus === 'PASS';
    const candidatePass = r.evaluation.passStatus === 'PASS';

    const stability = def.candidateSamples ? evaluateStability(def.candidateSamples, baselinePass) : null;
    const candResult = await writeResult(prisma, candidateRun.runCode, r.caseId, appCode, def.riskLevel, r.evaluation, stability);

    outcomes.push({
      caseId: r.caseId,
      baselinePass,
      candidatePass,
      candidateFailureType: r.evaluation.failureType,
      riskLevel: def.riskLevel,
    });

    if (!candidatePass && def.diagnosis) {
      await prisma.diagnosis.create({
        data: {
          resultId: candResult.id,
          appCode,
          primaryType: r.evaluation.failureType, // 主类型来自引擎
          conclusion: def.diagnosis.conclusion,
          evidence: J(def.diagnosis.evidence),
          possibleCauses: J(def.diagnosis.possibleCauses),
          suggestions: J(def.diagnosis.suggestions),
          confidence: def.diagnosis.confidence,
          generatedBy: def.diagnosis.generatedBy,
        },
      });
    }
  }

  // 用聚合器算对比（替换手写逻辑）
  const agg = aggregateComparison(outcomes);
  const total = outcomes.length;
  const basePass = outcomes.filter((o) => o.baselinePass).length;
  const candPass = outcomes.filter((o) => o.candidatePass).length;

  await prisma.regressionRun.update({ where: { runCode: baselineRun.runCode }, data: { totalCount: total, passCount: basePass, failCount: total - basePass } });
  await prisma.regressionRun.update({ where: { runCode: candidateRun.runCode }, data: { totalCount: total, passCount: candPass, failCount: total - candPass } });

  const staleResult = await prisma.caseResult.findFirst({ where: { runCode: candidateRun.runCode, passStatus: 'FAIL' } });
  const recLabel: Record<string, string> = { BLOCK: '阻断发布', REJECT: '不建议发布', MANUAL: '需人工评估', WATCH: '需关注', PASS: '可发布' };

  await prisma.comparison.create({
    data: {
      comparisonCode: 'CMP-0001',
      appCode,
      baselineRunCode: baselineRun.runCode,
      candidateRunCode: candidateRun.runCode,
      baselineVersionCode: 'v1.4.0',
      candidateVersionCode: 'v1.5.0-rc1',
      status: 'COMPLETED',
      releaseRecommendation: agg.releaseRecommendation,
      passRateDelta: agg.passRateDelta,
      newFailCount: agg.newFailCount,
      fixedFailCount: agg.fixedFailCount,
      persistentFailCount: agg.persistentFailCount,
      stabilityScore: staleResult?.stabilityScore ?? null,
      avgLatencyDeltaMs: -40,
      summary: J({
        degradationByType: agg.degradationByType,
        versionChange: ['Prompt 由 prompt@1.4 升级到 prompt@1.5（精简系统提示）'],
        note:
          agg.newFailCount > 0
            ? `存在 ${agg.newFailCount} 个新增失败（${Object.keys(agg.degradationByType).join('、')}），建议：${recLabel[agg.releaseRecommendation]}。`
            : '未发现退化，可发布。',
      }),
    },
  });

  await prisma.$disconnect();
  console.log(`✓ 北极星数据已由 eval-engine 计算并写入：基线 ${basePass}/${total} 通过，候选 ${candPass}/${total} 通过，新增失败 ${agg.newFailCount}，建议 ${agg.releaseRecommendation}`);
}

async function writeResult(
  prisma: ReturnType<typeof createPrismaClient>,
  runCode: string,
  caseId: number,
  appCode: string,
  riskLevel: string,
  evalResult: ReturnType<typeof evaluateCase>,
  stability?: { sampleCount: number; stabilityScore: number | null; regressionVerdict: string | null; regressionConfidence: number | null } | null,
) {
  const lastLatency = evalResult.turns.at(-1)?.latencyMs ?? null;
  const result = await prisma.caseResult.create({
    data: {
      runCode,
      caseId,
      appCode,
      passStatus: evalResult.passStatus,
      failureType: evalResult.failureType,
      riskLevel,
      latencyMs: lastLatency,
      turnsActual: J(evalResult.turns), // 含引擎计算的高亮
      sampleCount: stability?.sampleCount ?? null,
      stabilityScore: stability?.stabilityScore ?? null,
      regressionVerdict: stability?.regressionVerdict ?? null,
      regressionConfidence: stability?.regressionConfidence ?? null,
    },
  });
  // 断言行（来自引擎）
  if (evalResult.assertions.length > 0) {
    await prisma.assertionResult.createMany({
      data: evalResult.assertions.map((a) => ({
        resultId: result.id,
        turnIndex: a.turnIndex,
        assertionType: a.assertionType,
        expression: a.expression,
        expectedValue: J(a.expectedValue),
        actualValue: J(a.actualValue),
        passed: a.passed,
        evidenceSpan: a.evidenceSpan ? J(a.evidenceSpan) : null,
      })),
    });
  }
  return result;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
