<div align="center">

# QTP

**AI 应用回归测试平台 · AI Application Regression Testing Platform**

把真实多轮对话沉淀为可回放的回归资产，在改版后告诉你 —— **哪一轮退化了，为什么。**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-early%20development-orange.svg)](./ROADMAP.md)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20Prisma%20%2B%20SQLite-black.svg)](#架构)

[核心场景](#为什么需要-qtp) · [与现有工具的区别](#和-ragas--promptfoo--langfuse-有什么不同) · [快速开始](#快速开始) · [路线图](./ROADMAP.md)

</div>

---

## 为什么需要 QTP

AI 应用（对话助手、RAG、智能体、工作流）的测试和传统软件不一样：输出是**概率性**的，质量不只是"对不对"，而 Prompt、模型、知识库、工具链稍有变更就可能让历史能力**悄悄退化**。现有做法基本是手工聊天、截图、Excel 记录，攒不下可持续的回归资产，多轮对话尤其难测。

QTP 聚焦一个别的工具普遍不解决的问题：

> **你改了一版 Prompt / 模型 / 知识库，跑一遍回归，QTP 直接指给你看：**
> **第 3 轮里模型仍然在用旧的"员工数 80"（用户在第 2 轮已经改成了 20），**
> **并判断这是一次真实退化、而非随机抖动，给出证据链和修复方向。**

这一屏，是 QTP 想做到极致、并且和其他工具拉开差距的地方。

## 核心理念：测试资产飞轮

QTP 的核心不是"管理测试用例"，而是建立一个越用越值钱的回归资产飞轮：

```
真实会话  →  Golden Case  →  回归套件  →  版本执行对比
   ↑                                              ↓
高价值资产沉淀  ←  人工复核  ←  失败诊断  ←  识别退化
```

## 和 Ragas / promptfoo / Langfuse 有什么不同

一句话：**它们是"食材/调料"，QTP 是"厨房 + 出餐流程"。** QTP 不和它们拼"谁的分数算得准"——那些指标完全可以作为 QTP 内部的一种评分器接入。

|  | Ragas / DeepEval | promptfoo | Langfuse | **QTP** |
|---|---|---|---|---|
| 形态 | Python 库 | CLI / 配置 | 可观测平台 | **Web 平台** |
| 主要用户 | 工程师 | 工程师 | 工程师 | **测试人员 / QA 团队** |
| 回答的问题 | 这次输出质量分多少 | 这批用例过没过 | 线上发生了什么 | **改版后哪些退化了、第几轮、为什么** |
| 核心动作 | 对输出打分 | 跑断言 | 采集 trace | **基线 vs 候选版本对比 + 发布门禁** |
| 多轮对话 | 以单轮为主 | 以单轮为主 | 记录为主 | **上下文追踪断言（旧值/新值、指代、纠错）** |
| 失败处理 | 给一个分数 | PASS / FAIL | 看日志 | **证据链 + 可能原因 + 修复建议 + 人工复核** |
| 用例来源 | 自备 / 合成数据集 | 手写 YAML | — | **录真实对话一键转用例** |

QTP 的护城河刻意落在这几层 —— 它们比"打分准不准"更难、也更没人做好：

1. **随机性下的回归判定** —— 区分"真退化"和"采样噪声"，给出置信度，而不是武断地判 FAIL。
2. **多轮上下文状态追踪** —— 跨轮追踪变量更新，检测模型是否引用了陈旧上下文。
3. **可解释的失败诊断** —— 不只说"错了"，而是"第几轮、违反哪个断言、可能原因、怎么改"。
4. **不写代码也能用** —— 全程 Web 完成，面向不写 YAML / 不跑命令的测试人员。

## 状态

> ⚠️ **早期开发阶段。** QTP 正按 [路线图](./ROADMAP.md) 分阶段建设，优先把"多轮回归诊断"这一条垂直链路做深做透，而不是把模块铺广。当前不建议用于生产，欢迎围绕路线图讨论与共建。
>
> ✅ **北极星切片已可本地跑通**：`pnpm setup && pnpm dev` 即可在「回归对比 → 失败诊断」里看到改版后第 3 轮的上下文退化被定位出来（数据由 SQLite seed 提供）。

## 架构

QTP 是 **单体应用 + 零依赖本地启动**：一个 Next.js 进程同时承载前端与后端（Server Component / Route Handler 直读数据库），默认用 SQLite，不需要 Docker、不需要 MySQL。

```
Next.js（前端 + Server Component/Route Handler 后端）
    │  Prisma
    ▼
SQLite（默认，零依赖）  ——可切换——▶  MySQL（生产可选）
```

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 · TypeScript · Tailwind v4 · Radix UI · lucide-react |
| 后端 | Next.js Server Component / Route Handler |
| 数据 | Prisma · SQLite（默认）/ MySQL（可选） |
| 工程 | pnpm workspace |

目录结构：

```
QTP/
├── apps/
│   └── web/                       # Next.js 单体应用（前端 + 后端）
├── packages/
│   ├── shared-database/           # Prisma schema + 客户端 + seed（北极星数据）
│   ├── shared-config/             # 共享配置
│   └── shared-auth/               # 密码哈希与会话令牌
├── docs/                          # 定位 / 路线 / 设计规格
└── ROADMAP.md                     # 产品路线图
```

## 快速开始

### 前置依赖

- Node.js 24（推荐用 [fnm](https://github.com/Schniz/fnm) / nvm 管理）
- pnpm 11+

> 默认 SQLite，**无需 Docker 或 MySQL**。

### 一键启动

```bash
pnpm setup    # 安装依赖 + 生成 Prisma Client + 建库 + 写入北极星演示数据
pnpm dev      # 启动应用（http://127.0.0.1:3000/ai-quality-platform）
```

`pnpm setup` 等价于：`pnpm install && pnpm db:generate && pnpm db:push && pnpm db:seed`。

启动后直接体验北极星场景：左侧「回归对比」→ 看到候选版本 `v1.5.0-rc1` 通过率从 100% 跌到 66.7%、新增失败 1、建议「不建议发布」→ 点「查看诊断」→ 看到**第 3 轮模型仍用旧值 80（用户第 2 轮已改成 20）**、证据链与修复建议。

> 默认管理员：`admin` / `admin123`（可用 `QTP_ADMIN_INITIAL_PASSWORD` 覆盖后重新 `pnpm db:seed`）。

### 切换到 MySQL（可选）

把 `packages/shared-database/prisma/schema.prisma` 的 `provider` 改为 `mysql`，并设置 `DATABASE_URL` 指向你的 MySQL，再执行 `pnpm db:push && pnpm db:seed`。

## 路线图

QTP 按"先通链路 → 再做可信 → 再做差异化 → 再做惊艳"的顺序推进，每一阶段都比上一阶段更难、更不可替代。完整规划见 **[ROADMAP.md](./ROADMAP.md)**。

| 阶段 | 主题 | 关键能力 |
|---|---|---|
| 0 | 定位收敛 | 一句话定位 · 竞品矩阵 · v0.1 范围 |
| 1 | 最窄闭环 | 接入 · 多轮用例 · 执行 · 版本对比 |
| 2 | 随机性回归判定 | 多次采样 · 稳定性评分 · 区分真退化与抖动 |
| 3 | 多轮上下文追踪 | mustUpdateContext · mustNotUseStaleContext · 指代消解 |
| 4 | 失败诊断 | 逐轮 diff · 证据链 · 可能原因 · 修复建议 · 人工复核 |
| 5 | 资产飞轮 | 会话录制 · 一键转 Golden Case |
| 6 | 开源采纳基建 | 一键 demo 数据 · 演示录屏 · CLI / CI 接入 |

## 贡献

项目处于早期，最有价值的贡献是围绕路线图的讨论：定位是否准确、哪些阶段该重排、技术难点（尤其阶段 2/3）的实现思路。欢迎提 Issue 与 Discussion。

## License

[Apache License 2.0](./LICENSE) © 2026 QTP Contributors
