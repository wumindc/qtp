<div align="center">

# QTP

**AI 应用回归测试平台 · AI Application Regression Testing Platform**

把真实多轮对话沉淀为可回放的回归资产，在改版后告诉你 —— **哪一轮退化了，为什么。**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-early%20development-orange.svg)](./ROADMAP.md)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20NestJS%20%2B%20Prisma-black.svg)](#架构)

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

## 架构

QTP 采用 monorepo + 服务化边界设计，服务可独立启动、构建与部署：

```
Next.js Web
    │  HTTP
    ▼
quality-gateway  ──┬──▶ quality-platform-service     业务/用例/套件/复核/统计/系统
                   ├──▶ quality-execution-service    执行任务与版本对比
                   └──▶ quality-ai-invocation-service 统一 AI 模型调用
                                │
                          MySQL（Prisma）
```

| 层 | 技术 |
|---|---|
| 前端 | Next.js · TypeScript · Tailwind CSS · shadcn/ui · lucide-react |
| 后端 | NestJS · TypeScript |
| 数据 | MySQL · Prisma |
| 工程 | pnpm workspace · Docker Compose · nginx |

目录结构：

```
QTP/
├── apps/
│   ├── web/                            # Next.js 前端主应用
│   ├── quality-gateway/                # API 网关
│   ├── quality-platform-service/       # 平台业务服务
│   ├── quality-execution-service/      # 执行服务
│   └── quality-ai-invocation-service/  # AI 调用服务
├── packages/                           # 共享库（adapter / contract / config / db / http / auth）
├── docs/                               # 设计与需求文档
└── ROADMAP.md                          # 产品路线图
```

## 快速开始

### 前置依赖

- Node.js 24（推荐用 [fnm](https://github.com/Schniz/fnm) / nvm 管理）
- pnpm 11+
- Docker（用于本地 MySQL）

### 本地开发（Node 进程，支持热更新）

```bash
# 1. 安装依赖
pnpm install

# 2. 准备环境变量
cp .env.example .env   # 按需修改密钥与密码

# 3. 启动本地 MySQL 依赖
docker compose -f docker-compose.dev-deps.yml up -d

# 4. 初始化数据库
export DATABASE_URL="mysql://qtp_app:qtp_dev_password@127.0.0.1:3306/ai_quality_platform"
pnpm db:generate
pnpm db:push
QTP_ADMIN_INITIAL_PASSWORD="<本地管理员初始密码>" pnpm db:seed

# 5. 启动后端服务与网关，再启动前端
pnpm dev:services      # platform / execution / ai-invocation
pnpm dev:gateway       # quality-gateway
pnpm dev:web           # web（如遇 EMFILE，用 WATCHPACK_POLLING=true pnpm dev:web）
```

访问地址：

- 前端：http://127.0.0.1:3000/ai-quality-platform
- 网关健康检查：http://127.0.0.1:8080/ai-quality-platform/health.do

### 生产部署（Docker Compose 全栈）

```bash
export MYSQL_ROOT_PASSWORD="<生产 root 密码>"
export MYSQL_USER="qtp_app"
export MYSQL_PASSWORD="<生产应用库密码>"
export MYSQL_DATABASE="ai_quality_platform"
export QTP_AUTH_TOKEN_SECRET="<长随机密钥>"

docker compose up --build -d mysql
QTP_ADMIN_INITIAL_PASSWORD="<管理员初始密码>" docker compose run --rm quality-platform-service pnpm db:seed
PUBLIC_WEB_PORT=5670 docker compose up --build -d
```

访问：http://127.0.0.1:5670/ai-quality-platform

更多细节见 [docs/004-本地部署.md](./docs/004-本地部署.md)。

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
