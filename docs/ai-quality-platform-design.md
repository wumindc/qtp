# AI 应用质量评估平台设计文档

## 1. 项目定位

项目名称：AI 应用质量评估平台

项目文根：`ai-quality-platform`

系统定位：面向 AI 应用的质量治理平台，帮助测试人员通过 Web 页面完成 AI 应用接入、测试用例维护、测试计划执行、自动评分、人工复核、统计看板和回归沉淀。

本项目按正式生产系统规划，不以临时 Demo 为目标。系统可以分阶段建设，但每个阶段交付的功能都应形成完整闭环，不交付只有页面、没有真实数据流和业务处理的半成品功能。

## 2. 建设原则

1. 正式项目优先

   平台从第一天按长期演进系统设计，前后端、数据库、执行恢复和部署方式都预留生产化扩展空间。

2. 分阶段交付，功能完整

   可以先做少量模块，但每个模块都必须包含页面、接口、数据模型、权限控制、状态流转、异常处理和基础测试验证。

3. 面向弱技术测试人员

   测试人员不需要写 YAML、跑命令、理解 Dify API 或 Promptfoo 配置。所有关键操作都应在 Web 平台完成。

4. 以应用层接口为主测对象

   测试平台调用已登记的 AI 应用层接口，评估真实业务链路的最终输出质量；第一版不提供绕过应用层的底层平台直连测试能力。

5. 用例体系是核心资产

   平台的核心不是一次性执行脚本，而是长期沉淀测试分类、测试用例、评分标准、复核结论和回归集。

6. 服务边界前置规划

   后端按服务化边界设计，避免后期推倒重构。第一版即可采用 monorepo 管理多个 NestJS 服务应用，服务可独立启动、独立构建、独立 Docker 部署。

## 3. 技术选型

### 3.1 前端

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react

前端风格参考 Dify、Linear、Vercel Console 等现代 SaaS 管理台。避免传统 antd Pro 后台风格。

视觉基准采用混合策略：

- 整体结构偏 Dify：左侧导航、清爽工作区、功能入口明确。
- 信息组织参考 Linear：列表、状态、筛选、任务流更利于高频操作。
- 细节质感参考 Vercel Console：留白、边框、按钮、空状态和加载态更克制。

最终目标不是复刻某个产品，而是形成清爽、现代、专业、适合测试人员长期使用的 AI 质量工作台。

### 3.2 后端

- NestJS
- TypeScript
- MySQL
- Prisma

ORM 选型：Prisma。

Prisma 类型体验好、迁移清晰，适合多服务项目统一管理数据库模型和迁移脚本。

### 3.3 本地基础设施

MySQL：

```text
host: 127.0.0.1
port: 3306
user: root
password: root
database: ai_quality_platform
```

## 4. 总体架构

```text
Next.js Web
  |
  | HTTP
  v
  Quality Gateway
    |
    +--> quality-platform-service
    +--> quality-execution-service
    +--> quality-ai-invocation-service

quality-ai-invocation-service
  +--> packages/ai-invocation-contract
  +--> packages/ai-model-adapter

MySQL: 业务数据、用例、计划、执行结果、复核、统计
```

第一阶段建议在一个 monorepo 中建设：

```text
ai-quality-platform/
  apps/
    web/
    quality-gateway/
    quality-platform-service/
    quality-execution-service/
    quality-ai-invocation-service/
  packages/
    ai-invocation-contract/
    ai-invocation-client/
    ai-model-adapter/
    shared-config/
    shared-http/
    shared-database/
    shared-logger/
    shared-auth/
  docs/
```

Monorepo 工具选择：

- pnpm workspace

第一阶段先不引入 Nx 或 Turborepo，保持工程结构清晰、依赖管理简单。后续如果构建速度、任务编排或缓存需求变强，再评估是否增加 Turborepo。

本地端口规划：

| 应用/服务 | 端口 | 说明 |
| --- | --- | --- |
| web | 3000 | Next.js 前端 |
| quality-gateway | 8080 | 前端统一后端入口 |
| quality-platform-service | 3101 | 内部端口，应用、用例、计划、模型配置、复核、统计和系统能力 |
| quality-execution-service | 3104 | 内部端口，执行、评估、计费和任务恢复 |
| quality-ai-invocation-service | 3105 | 内部端口，统一外部模型调用运行时 |
| MySQL | 3306 | 本地数据库 |

生产端口规划：Docker Compose 只暴露 nginx 最终入口，默认 `${PUBLIC_WEB_PORT:-5670}:80`。`web`、`quality-gateway`、`quality-platform-service`、`quality-execution-service`、`quality-ai-invocation-service` 和 MySQL 均只在 Docker 网络内通信，不映射宿主机端口。

前端本地访问地址：

```text
http://127.0.0.1:3000/ai-quality-platform
```

## 5. 后端服务拆分

### 5.1 前端访问方式

开发环境中，前端不直连 platform/execution/AI invocation 服务端口，只访问统一 Gateway 入口；生产环境中，浏览器只访问 nginx 最终入口。

后端只保留 gateway、platform、execution、AI invocation 这几个真实运行单元。生产环境由 nginx 对外暴露系统入口，再把 API 转发给 quality-gateway；quality-gateway 根据公开 API 段转发到 platform 或 execution，并聚合 AI invocation 健康状态。这样既保留外部接口稳定性，也避免把普通业务模块拆成过多独立进程。

开发环境前端可见接口统一挂载在：

```text
http://127.0.0.1:8080/ai-quality-platform/api/**
```

生产环境前端可见接口通过 nginx 同源访问：

```text
/ai-quality-platform/api/**
```

所有业务接口以 `.do` 结尾。

示例：

```text
platform-service: /ai-quality-platform/api/business/app/list.do
platform-service: /ai-quality-platform/api/case/case/create.do
execution-service: /ai-quality-platform/api/execution/execution/start.do
```

代理转发规则示例：

```text
/ai-quality-platform/api/business/*   -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/case/*       -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/plan/*       -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/execution/*  -> http://127.0.0.1:3104/ai-quality-platform/*
/ai-quality-platform/api/ai/*         -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/review/*     -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/statistics/* -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/system/*     -> http://127.0.0.1:3101/ai-quality-platform/*
```

### 5.2 quality-platform-service

负责常规业务管理能力，内部按模块划分，不再把同库 CRUD 模块拆成多个独立进程。

核心能力：

- AI 应用登记
- 对话问答类应用登记
- 应用层接口配置
- 环境配置
- 认证配置
- 负责人配置
- 应用状态管理
- 用例分类管理
- 用例新增、编辑、删除、启停
- 预期行为配置
- Excel 导入导出
- 系统预置分类订阅
- 应用自有用例管理
- 按应用、分类和显式选中用例筛选执行范围
- 模型供应商配置
- 评分模型配置
- 模型连接测试
- 人工复核列表
- 人工判定
- 工作台统计
- 应用质量概览
- 用户登录和基础系统配置

### 5.3 quality-execution-service

负责执行调度和结果采集，是平台核心服务之一。

核心能力：

- 创建执行批次
- 拆分执行任务
- 调用被测 AI 应用层接口
- 记录请求、响应、耗时、错误
- 维护执行状态
- 支持重跑失败用例
- 支持取消执行
- 根据应用适配器配置完成请求参数映射
- 根据响应映射规则抽取最终答案和错误信息
- 按 `APP_CALLING -> EVALUATING -> COSTING` 推进持久化执行阶段
- 服务启动时扫描 `RUNNING` 批次并恢复未完成任务
- 记录评估模型调用审计、usage 和费用

由于被测 AI 应用层接口无法保证统一输入输出格式，执行服务不能硬编码单一调用协议。平台需要为每个 AI 应用维护“接口适配器配置”，包括请求构造、字段映射、响应抽取和错误识别规则。

### 5.4 quality-ai-invocation-service、contract 与 adapter

`quality-ai-invocation-service` 负责统一外部模型调用运行时，platform 的供应商模型发现、模型测试和 execution 的评估调用都通过 `packages/ai-invocation-client` 访问该内部服务。`packages/ai-invocation-contract` 只沉淀纯请求响应契约、usage 归一和失败结果结构；`packages/ai-model-adapter` 负责沉淀供应商协议 SDK，只在 AI invocation 边界内复用，不单独作为进程部署，也不作为 platform/execution 或 invocation client 的直接依赖。

核心能力：

- OpenAI compatible 请求体构造
- Qwen/DeepSeek thinking 参数由抽象 `providerKind/enableThinking` 转换为供应商请求字段
- 供应商 `/models` 模型发现
- 评估调用默认关闭 thinking
- usage 字段归一
- 错误码和原始响应保留
- 后续成本归一和供应商治理能力预留

LLM Judge 不依赖被测 AI 应用层，采用平台内单独配置的模型供应商。供应商配置由系统管理员维护，可支持不同环境配置不同模型。

第一批支持的模型供应商：

- OpenAI 兼容接口
- 通义千问
- DeepSeek

模型供应商配置应支持：

- 供应商编码
- 供应商名称
- API Base URL
- API Key
- 默认模型
- 超时时间
- 是否启用
- 连接测试

登录方式采用本地账号密码。第一阶段先做简单版本，不强制验证码、密码复杂度和首次登录改密，但数据模型和系统设置中预留后续增强空间。

### 5.5 接口适配器能力

由于被测 AI 应用接口不能统一输入输出格式，平台需要内置接口适配器能力。

适配器配置属于 AI 应用管理的一部分，由开发或架构人员维护，测试人员只选择应用和用例，不直接编辑复杂协议。

适配器配置包括：

- 请求方式
- 请求地址
- Header 配置
- 认证方式
- 请求体模板
- 用户问题字段映射
- 会话字段映射
- 用户上下文字段映射
- 响应内容字段路径
- 错误码字段路径
- 成功条件表达式
- 超时时间
- 是否流式响应
- 流式响应解析规则

示例：

```json
{
  "request": {
    "method": "POST",
    "url": "https://example.com/ai/chat",
    "headers": {
      "Content-Type": "application/json"
    },
    "bodyTemplate": {
      "query": "{{case.input.query}}",
      "sessionId": "{{run.sessionId}}",
      "user": "{{case.userContext}}"
    }
  },
  "response": {
    "answerPath": "$.content",
    "successExpression": "$.code == 200"
  }
}
```

第一版适配器支持 JSON Path 字段抽取、简单模板替换，以及普通 JSON 响应和流式响应两类被测应用。后续再扩展脚本型适配器。

流式响应适配要求：

- 支持 SSE 风格响应
- 支持按行增量解析
- 支持从流式片段中抽取 answer delta
- 支持汇总最终答案
- 支持记录完整原始流
- 支持流式超时控制
- 支持流中错误事件识别

流式适配器示例：

```json
{
  "request": {
    "method": "POST",
    "url": "https://example.com/ai/chat-stream",
    "bodyTemplate": {
      "query": "{{case.input.query}}",
      "stream": true
    }
  },
  "stream": {
    "enabled": true,
    "protocol": "sse",
    "deltaPath": "$.data.answer",
    "doneMarker": "[DONE]",
    "errorPath": "$.error.message"
  },
  "response": {
    "answerPath": "$.aggregatedAnswer",
    "successExpression": "$.error == null"
  }
}
```

### 5.11 跨域与健康检查

由于前端统一访问代理入口，浏览器侧只需要面对一个 API Origin。后端服务仍保留统一 CORS 配置，用于本地调试、服务直连排查和非浏览器客户端调用。

跨域要求：

- 开发环境允许代理服务访问各后端服务
- 生产环境通过配置指定允许来源
- 支持携带认证信息
- OPTIONS 预检请求统一处理
- CORS 配置放入共享配置包，避免各服务分散维护

每个真实运行单元必须提供健康检查接口：

```text
GET /ai-quality-platform/health.do
```

健康检查返回：

```json
{
  "code": 0,
  "success": true,
  "message": "ok",
  "data": {
    "service": "quality-platform-service",
    "status": "UP",
    "dependencies": {
      "database": { "status": "UP" },
      "modelProviders": { "status": "DIAGNOSTIC_ONLY" }
    },
    "time": "2026-05-18T00:00:00.000Z"
  }
}
```

前端增加“服务健康检查”页面，用于展示 gateway、platform、execution、AI invocation 等关键运行单元状态、数据库状态、Worker 状态和最后检测时间，方便正式部署和联调排查。

前端健康检查页只访问 gateway 聚合健康接口，不展示内部服务 URL：

```text
/ai-quality-platform/health.do
```

## 6. 前端页面规划

### 6.1 工作台

面向测试负责人和测试人员，展示平台总体质量状态。

核心内容：

- AI 应用数量
- 测试用例数量
- 本周执行批次
- 平均通过率
- 待复核数量（来自当前执行结果中 `REVIEW` 且未被人工结论覆盖的结果）
- 未达标批次数量（来自存在未达标结果的执行批次）
- 最近执行批次
- 低通过率应用

### 6.2 AI 应用管理

用于登记被测 AI 应用。

字段：

- 应用名称
- 应用编码
- 应用类型（当前固定为 `CHAT`）
- 业务领域
- 应用层接口地址
- 请求方式
- 认证方式
- 接口适配器配置
- 负责人
- 状态

### 6.3 测试用例管理

平台核心页面。

字段：

- 所属应用
- 用例分类
- 用户问题
- 期望行为
- 启用状态

### 6.4 测试计划管理

用于组织测试范围，仅维护计划名称、所属应用和执行范围。

### 6.5 执行记录

展示每次执行批次。

批次状态：

- 待执行
- 执行中
- 评分中
- 已完成
- 已取消
- 执行异常

结果状态：

- PASS
- FAIL
- REVIEW

### 6.6 执行结果人工修订

第一版不提供独立“人工复核中心”。人工修订直接发生在执行详情页的具体结果上，避免制造脱离执行记录的虚拟待办。

修订内容：

- 标为通过
- 标为未达标
- 恢复 AI 原始评估
- 记录人工备注

### 6.7 统计看板

第一版不提供离线报告生成/导出中心，只保留基于真实执行数据的工作台与应用概览统计：

- 应用数量
- 用例数量
- 执行计划数量
- 最近执行记录
- 通过率
- 未达标数量
- 待复核数量
- 低通过率应用

## 7. 用例分类体系

第一版内置 10 类：

| 分类编码 | 分类名称 | 说明 |
| --- | --- | --- |
| NORMAL_QA | 常规问答 | 正常业务咨询 |
| STRICT_QA | 严谨问答 | 要求依据、边界、审慎表达 |
| WRONG_PREMISE | 错误前提 | 用户问题本身包含错误假设 |
| OUT_OF_SCOPE | 无关问题 | 与业务无关的问题 |
| SENSITIVE_BOUNDARY | 敏感边界 | 违规、越权、涉密、涉黄涉政等边界问题 |
| FUZZY_QUERY | 模糊问题 | 输入过短、指代不明 |
| MULTI_TURN | 多轮对话 | 上下文连续性 |
| FORMAT_OUTPUT | 格式输出 | JSON、Markdown、表格等 |
| RAG_QA | 知识库问答 | 依赖知识库检索 |
| EXCEPTION_STABILITY | 异常稳定性 | 空输入、超长输入、接口异常 |

分类用于组织系统预置用例和应用自有用例，并作为计划筛选和统计分组的基础。

## 8. 执行链路

```text
测试人员选择计划
  -> 创建执行批次
  -> 查询计划命中的用例
  -> 生成执行任务
  -> execution-service 持久化任务并推进阶段
  -> execution-service 调用被测应用接口
  -> 保存原始请求响应
  -> execution-service 调用 quality-ai-invocation-service
  -> quality-ai-invocation-service 按 ai-invocation-contract 接收请求
  -> quality-ai-invocation-service 通过 ai-model-adapter 调用评估模型
  -> 汇总最终状态
  -> platform-service 查询统计和复核数据
```

## 9. 核心数据模型

### 9.1 AI 应用表

`ai_app`

- id
- app_code
- app_name
- app_type
- business_domain
- invoke_url
- request_method
- auth_type
- auth_config
- owner
- status
- created_at
- updated_at

### 9.2 测试用例表

`eval_case`

- id
- app_code
- case_scope
- category_id
- input_json
- expected_json
- enabled
- created_at
- updated_at

### 9.3 测试计划表

`eval_plan`

- id
- plan_code
- plan_name
- app_code
- case_filter_json
- status
- created_by
- created_at
- updated_at

### 9.4 执行批次表

`eval_run`

- id
- run_code
- plan_code
- app_code
- run_name
- status
- total_count
- app_completed_count
- eval_completed_count
- pass_count
- fail_count
- review_count
- avg_score
- token 与费用汇总字段
- cost_status
- started_at
- finished_at
- created_by

### 9.5 执行结果表

`eval_result`

- id
- run_code
- case_id
- app_code
- case_snapshot_json
- app_status
- evaluation_status
- request_json
- response_json
- final_answer
- final_score
- pass_status
- failure_reason
- problem_type
- elapsed_ms
- app_elapsed_ms
- judge_elapsed_ms
- error_code
- created_at
- updated_at

### 9.6 模型评估调用审计表

`eval_judge_call`

- id
- call_code
- run_code
- result_id
- app_code
- case_id
- provider_code
- model_db_id
- model_id
- protocol
- prompt_text
- request_json
- response_json
- raw_response_text
- raw_usage_json
- token 与费用明细字段
- cost_status
- status
- error_code
- error_message
- elapsed_ms
- created_at
- updated_at

### 9.7 人工复核表

`eval_review`

- id
- result_id
- manual_result
- review_comment
- reviewed_at
- created_at

## 10. 接口规范

统一前缀：

```text
/ai-quality-platform
```

统一后缀：

```text
.do
```

示例接口：

```text
POST /ai-quality-platform/app/list.do
POST /ai-quality-platform/app/create.do
POST /ai-quality-platform/app/update.do
POST /ai-quality-platform/app/delete.do

POST /ai-quality-platform/case/list.do
POST /ai-quality-platform/case/create.do
POST /ai-quality-platform/case/update.do
POST /ai-quality-platform/case/import-csv.do
GET  /ai-quality-platform/case/export.do

POST /ai-quality-platform/plan/list.do
POST /ai-quality-platform/plan/create.do
POST /ai-quality-platform/plan/start.do

POST /ai-quality-platform/execution/run-list.do
POST /ai-quality-platform/execution/result-list.do
POST /ai-quality-platform/execution/rerun.do
POST /ai-quality-platform/execution/cancel.do

POST /ai-quality-platform/review/list.do
POST /ai-quality-platform/review/submit.do

GET  /ai-quality-platform/report/dashboard.do
```

列表接口请求结构：

```json
{
  "page": {
    "currentPage": 1,
    "linesPerPage": 10,
    "orderBys": [
      {
        "sortField": "updatedAt",
        "sortType": "DESC"
      }
    ]
  },
  "data": {}
}
```

列表接口响应结构：

```json
{
  "list": [],
  "page": {
    "totalNum": 0,
    "currentPage": 1,
    "linesPerPage": 10,
    "totalPage": 0
  }
}
```

普通接口响应结构：

```json
{
  "code": 0,
  "success": true,
  "message": "ok",
  "data": {}
}
```

## 11. Docker 部署规划

第一阶段 Docker 服务：

```text
nginx
ai-quality-web
ai-quality-gateway
quality-platform-service
quality-execution-service
mysql
```

开发环境标准为 Node 本机进程，Docker 只用于 MySQL 依赖；生产环境标准为 Docker Compose 全栈部署，仅 nginx 映射宿主机端口。真实运行单元需具备独立构建和独立部署能力；普通业务模块作为 platform 内部模块维护。

## 12. 第一阶段建设范围

第一阶段目标：跑通完整质量评估闭环。

第一阶段采用“逐个功能完整交付”的方式推进。每个功能完成时，都必须包含前端页面、后端接口、数据库模型、真实数据流、异常处理、基础验证和文档更新。

第一阶段功能开发顺序：

1. 工程初始化与基础设施
   - pnpm workspace
   - Next.js 前端
   - 多 NestJS 服务
   - Prisma
   - MySQL 连接
   - 统一配置
   - 统一 CORS
   - 统一 Gateway 入口规划
   - 健康检查接口
   - 服务健康检查页面

2. 登录和基础用户
   - 本地账号密码登录
   - 管理员账号由 `QTP_ADMIN_USERNAME` 初始化，默认用户名为 `admin`
   - 管理员初始密码必须通过 `QTP_ADMIN_INITIAL_PASSWORD` 显式提供，入库只保存哈希
   - 用户表
   - 登录接口
   - 登录页
   - 登录态维护
   - 基础角色预留

3. AI 应用管理
   - AI 应用列表
   - 新增、编辑、删除、启停
   - 应用接口配置
   - 被测应用接口适配器
   - 连接测试

4. 模型供应商配置
   - OpenAI 兼容接口
   - 通义千问
   - DeepSeek
   - 供应商新增、编辑、启停
   - 连接测试

5. 测试用例管理
   - 用例分类内置
   - 用例列表
   - 新增、编辑、删除、启停
   - Excel 导入
   - Excel 导出
   - Excel 模板下载
   - Excel 模板按平台完整字段设计
   - 期望行为
   - 期望回答
   - 系统预置分类订阅

6. 测试计划管理
   - 计划列表
   - 新增、编辑、删除、启停
   - 按应用、分类和显式选中用例筛选用例

7. 执行批次与执行 Worker
   - 创建执行批次
   - 根据计划生成任务
   - 执行服务持久化任务并推进 APP_CALLING / EVALUATING / COSTING 阶段
   - 执行状态维护
   - 取消执行
   - 重跑失败用例

8. 被测应用调用
   - 普通 JSON 响应调用
   - SSE 流式响应调用
   - 最终答案抽取
   - 原始响应保存
   - 错误识别

9. 自动评分
   - LLM Judge 基础实现
   - 按用例分类选择评分模板
   - 评分理由保存
   - 结果状态汇总

10. 执行结果列表
    - 批次列表
    - 结果列表
    - 结果详情
    - 请求响应查看
    - 评分明细

11. 人工复核
    - 待复核列表
    - 人工判定
    - 问题类型标记
    - 复核备注
    - 加入回归用例

12. 统计看板
    - 总体通过率
    - 分类统计
    - 最近执行记录
    - 低通过率应用

13. Docker 与 CI 部署脚本
    - 前端镜像
    - gateway/platform/execution/AI invocation 后端服务镜像
    - MySQL 配置
    - docker compose 本地启动
    - CI 执行拓扑检查、类型检查、测试和 Web 构建

14. 初始化数据与导入边界
    - 系统启动只初始化管理员账号，不内置业务应用、业务用例、执行计划或报告样例
    - 系统预置用例与应用自有用例通过 CSV 导入或页面维护形成真实业务数据
    - 被测 AI 应用由用户在应用详情中配置真实接口地址、请求模板、响应抽取和执行计划

暂缓：

- 多租户
- 复杂审批流
- 复杂发布审批和多环境发布编排
- 多模型横向对比
- Promptfoo / DeepEval / Ragas 深度集成
- Langfuse 深度集成

## 13. 关键待确认事项

1. 已确认 ORM 选择 Prisma。
2. 已确认前端不直连各后端服务端口，统一通过 quality-gateway访问后端。
3. 已确认登录方式采用本地账号密码。
4. 已确认 LLM Judge 单独配置模型供应商。
5. 已确认被测 AI 应用接口不能统一输入输出格式，因此必须建设接口适配器能力。
6. 已确认本地账号密码第一版做简单版本，验证码、密码复杂度、首次登录改密后续完善。
7. 已确认模型供应商第一批支持 OpenAI 兼容接口、通义千问、DeepSeek。
8. 已确认接口适配器第一版需要支持流式响应。
9. 已确认需要提供统一 Gateway 入口、统一处理跨域，并提供服务健康检查页面。
10. 已确认开发环境使用 Node 本机进程，本地端口由 Codex 统一规划：前端 3000，统一 Gateway 8080，platform 服务 3101，execution 服务 3104，AI invocation 服务 3105；生产环境使用 Docker Compose，只暴露 nginx 最终入口，默认 5670。
11. 已确认 Monorepo 使用 pnpm workspace。
12. 已确认第一阶段按功能逐个完整开发，不做半成品模块。
13. 已确认第一版接入 Excel 导入导出。
14. 已确认第一版不内置演示业务数据，系统启动只初始化管理员账号；用例和应用数据通过 CSV 导入或页面维护。
15. 已确认 Excel 模板按平台完整字段设计。
16. 已确认被测 AI 应用通过真实接口配置接入，不在平台内置示例被测服务。

后续仍需确认：

1. 是否现在开始进入工程初始化阶段。
