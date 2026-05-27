'use client';
/**
 * 执行计划数据 Hook
 * - 加载计划列表 + 执行历史
 * - 检测 RUNNING 状态，自动轮询（每 5s）
 * @author Antigravity/Claude-Sonnet-4.6
 * @author codex
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import {
  listPlans,
  listRuns,
  type PlanRecord,
  type RunRecord,
} from './api/plan-execution-api';
import { postGateway } from '@/lib/api/gateway-client';

export interface Category {
  id: string;
  name: string;
}

export interface UsePlanRunsResult {
  plans: PlanRecord[];
  /** 按 planCode 归组的执行记录，按时间降序 */
  runsByPlan: Map<string, RunRecord[]>;
  /** 总执行次数 */
  totalRunsByPlan: Map<string, number>;
  categories: Category[];
  loading: boolean;
  /** 手动刷新（不重置 loading） */
  refresh: () => Promise<void>;
  /** 强制全量重载（显示 loading） */
  reload: () => Promise<void>;
  /** 将新执行批次立即合并进本地列表 */
  upsertRun: (run: RunRecord) => void;
}

const POLL_INTERVAL_MS = 5000;

function readList<T>(payload: unknown): T[] {
  const record = payload as { list?: T[]; data?: { list?: T[] } } | undefined;
  if (Array.isArray(record?.list)) return record.list;
  if (Array.isArray(record?.data?.list)) return record.data.list;
  return [];
}

function mergeCategories(...categoryGroups: Category[][]): Category[] {
  const merged = new Map<string, Category>();
  categoryGroups.flat().forEach((category) => {
    merged.set(category.id, { ...merged.get(category.id), ...category });
  });
  return Array.from(merged.values());
}

function mergeRunsKeepingActive(freshRuns: RunRecord[], previousRuns: RunRecord[]): RunRecord[] {
  const freshCodes = new Set(freshRuns.map((run) => run.runCode));
  const pendingRuns = previousRuns.filter(
    (run) => run.status === 'RUNNING' && !freshCodes.has(run.runCode),
  );
  return [...freshRuns, ...pendingRuns];
}

function readRunSortTime(run: RunRecord): number {
  const timeText = run.startAt ?? run.endAt;
  const time = timeText ? new Date(timeText).getTime() : Number.NaN;
  if (Number.isFinite(time)) return time;
  const legacyTime = Number(run.runCode.split('_RUN_')[1] ?? 0);
  return Number.isFinite(legacyTime) ? legacyTime : 0;
}

export async function loadPlanCategories(appCode: string): Promise<Category[]> {
  const [appCategoryResponse, subscribedCategoryResponse] = await Promise.all([
    postGateway<unknown>(
      'case',
      '/case/category/list.do',
      {
        page: { currentPage: 1, linesPerPage: 200 },
        data: { appCode, includeGlobal: false },
      },
      { cache: 'no-store' },
    ),
    postGateway<unknown>(
      'case',
      '/case/category/list.do',
      {
        page: { currentPage: 1, linesPerPage: 200 },
        data: { subscribedByApp: appCode },
      },
      { cache: 'no-store' },
    ),
  ]);

  return mergeCategories(
    readList<Category>(appCategoryResponse),
    readList<Category>(subscribedCategoryResponse),
  );
}

export function usePlanRuns(appCode: string): UsePlanRunsResult {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** @author codex 按真实执行时间降序排序，旧数据才回退解析 runCode。 */
  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const diff = readRunSortTime(b) - readRunSortTime(a);
      return diff === 0 ? b.runCode.localeCompare(a.runCode) : diff;
    });
  }, [runs]);

  const runsByPlan = useMemo(() => {
    return sortedRuns.reduce<Map<string, RunRecord[]>>((map, run) => {
      const arr = map.get(run.planCode) ?? [];
      arr.push(run);
      map.set(run.planCode, arr);
      return map;
    }, new Map());
  }, [sortedRuns]);

  const totalRunsByPlan = useMemo(() => {
    const m = new Map<string, number>();
    runsByPlan.forEach((arr, code) => m.set(code, arr.length));
    return m;
  }, [runsByPlan]);

  /** 是否存在 RUNNING 状态的任务 */
  const hasRunning = useMemo(
    () => runs.some((r) => r.status === 'RUNNING'),
    [runs],
  );

  /** 拉取执行记录（轻量，不显示 loading） */
  const fetchRuns = useCallback(async () => {
    try {
      const data = await listRuns(appCode);
      setRuns((prev) => mergeRunsKeepingActive(data, prev));
    } catch {
      // 静默失败，不影响界面
    }
  }, [appCode]);

  /** 全量加载（显示 loading） */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, catsResult, runsResult] = await Promise.allSettled([
        listPlans(appCode),
        loadPlanCategories(appCode),
        listRuns(appCode),
      ]);

      if (plansResult.status === 'fulfilled') {
        setPlans(plansResult.value);
      } else {
        setPlans([]);
        toast.error('加载计划列表失败');
      }

      if (catsResult.status === 'fulfilled') {
        setCategories(catsResult.value);
      } else {
        setCategories([]);
      }

      if (runsResult.status === 'fulfilled') {
        setRuns(runsResult.value);
      } else {
        setRuns([]);
      }
    } finally {
      setLoading(false);
    }
  }, [appCode]);

  /** 手动刷新（不显示 loading） */
  const refresh = useCallback(async () => {
    const [plansData, runsData] = await Promise.allSettled([
      listPlans(appCode),
      listRuns(appCode),
    ]);
    if (plansData.status === 'fulfilled') setPlans(plansData.value);
    if (runsData.status === 'fulfilled') {
      setRuns((prev) => mergeRunsKeepingActive(runsData.value, prev));
    }
  }, [appCode]);

  const upsertRun = useCallback((run: RunRecord) => {
    setRuns((prev) => [run, ...prev.filter((item) => item.runCode !== run.runCode)]);
  }, []);

  // 首次加载
  useEffect(() => {
    void reload();
  }, [reload]);

  // 轮询：存在 RUNNING 任务时每 5s 拉执行记录
  useEffect(() => {
    if (hasRunning) {
      pollingRef.current = setInterval(() => {
        void fetchRuns();
      }, POLL_INTERVAL_MS);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasRunning, fetchRuns]);

  return {
    plans,
    runsByPlan,
    totalRunsByPlan,
    categories,
    loading,
    refresh,
    reload,
    upsertRun,
  };
}
