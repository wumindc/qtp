# AI 应用质量评估平台设计文档

## 1. 项目定位

项目名称：AI 应用质量评估平台

项目文根：`ai-quality-platform`

系统定位：面向 AI 应用的质量治理平台，帮助测试人员通过 Web 页面完成 AI 应用接入、测试用例维护、测试计划执行、自动评分、人工复核、报告输出和回归沉淀。

本项目按正式生产系统规划，不以临时 Demo 为目标。系统可以分阶段建设，但每个阶段交付的功能都应形成完整闭环，不交付只有页面、没有真实数据流和业务处理的半成品功能。

## 2. 建设原则

1. 正式项目优先

   平台从第一天按长期演进系统设计，前后端、数据库、队列、部署方式都预留生产化扩展空间。

2. 分阶段交付，功能完整

   可以先做少量模块，但每个模块都必须包含页面、接口、数据模型、权限控制、状态流转、异常处理和基础测试验证。

3. 面向弱技术测试人员

   测试人员不需要写 YAML、跑命令、理解 Dify API 或 Promptfoo 配置。所有关键操作都应在 Web 平台完成。

4. 以应用层接口为主测对象

   测试平台优先调用自研 AI 应用层接口，评估真实业务链路的最终输出质量。Dify 直连测试作为底层专项能力保留。

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
- TanStack Table
- Recharts

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
- Redis
- BullMQ
- Prisma 或 TypeORM

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

Redis：

```text
host: 127.0.0.1
port: 6379
password: sunsharing
```

Redis 主要用于执行任务队列、异步评分任务、执行状态缓存、报告生成任务和后续分布式锁。

## 4. 总体架构

```text
Next.js Web
  |
  | HTTP
  v
Quality Gateway
  |
  +--> quality-business-service
  +--> quality-case-service
  +--> quality-plan-service
  +--> quality-execution-service
  +--> quality-ai-service
  +--> quality-review-service
  +--> quality-statistics-service
  +--> quality-system-service

MySQL: 业务数据、用例、计划、结果、复核、报告
Redis: 队列、任务状态、缓存、异步执行
```

第一阶段建议在一个 monorepo 中建设：

```text
ai-quality-platform/
  apps/
    web/
    business-service/
    case-service/
    plan-service/
    execution-service/
    ai-service/
    review-service/
    statistics-service/
    system-service/
  packages/
    shared-types/
    shared-config/
    shared-database/
    shared-logger/
    shared-auth/
    shared-http/
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
| quality-business-service | 3101 | 内部端口，AI 应用与业务配置 |
| quality-case-service | 3102 | 内部端口，测试用例 |
| quality-plan-service | 3103 | 内部端口，测试计划 |
| quality-execution-service | 3104 | 内部端口，执行调度 |
| quality-ai-service | 3105 | 内部端口，AI 评分与模型供应商 |
| quality-review-service | 3106 | 内部端口，人工复核 |
| quality-statistics-service | 3107 | 内部端口，统计报告 |
| quality-system-service | 3108 | 内部端口，用户、权限、字典、日志 |
| MySQL | 3306 | 本地数据库 |
| Redis | 6379 | 本地队列与缓存 |

前端本地访问地址：

```text
http://127.0.0.1:3000/ai-quality-platform
```

## 5. 后端服务拆分

### 5.1 前端访问方式

前端不直连各后端服务端口，只访问统一 Gateway 入口。

每个服务仍独立暴露内部 HTTP 端口，但这些端口只作为服务内部端口使用。前端统一访问 quality-gateway，由反代层根据路径转发到具体服务。这样既保留后端服务边界，也避免前端配置多个服务地址。

所有前端可见接口仍统一挂载在：

```text
http://127.0.0.1:8080/ai-quality-platform/api/**
```

所有业务接口以 `.do` 结尾。

示例：

```text
business-service: /ai-quality-platform/api/business/app/list.do
case-service: /ai-quality-platform/api/case/case/create.do
execution-service: /ai-quality-platform/api/execution/run/start.do
```

代理转发规则示例：

```text
/ai-quality-platform/api/business/*   -> http://127.0.0.1:3101/ai-quality-platform/*
/ai-quality-platform/api/case/*       -> http://127.0.0.1:3102/ai-quality-platform/*
/ai-quality-platform/api/plan/*       -> http://127.0.0.1:3103/ai-quality-platform/*
/ai-quality-platform/api/execution/*  -> http://127.0.0.1:3104/ai-quality-platform/*
/ai-quality-platform/api/ai/*         -> http://127.0.0.1:3105/ai-quality-platform/*
/ai-quality-platform/api/review/*     -> http://127.0.0.1:3106/ai-quality-platform/*
/ai-quality-platform/api/statistics/* -> http://127.0.0.1:3107/ai-quality-platform/*
/ai-quality-platform/api/system/*     -> http://127.0.0.1:3108/ai-quality-platform/*
```

### 5.2 quality-business-service

负责 AI 应用和业务配置。

核心能力：

- AI 应用登记
- 应用类型维护
- 应用层接口配置
- 环境配置
- 认证配置
- 负责人配置
- 应用状态管理

### 5.3 quality-case-service

负责测试用例体系。

核心能力：

- 用例分类管理
- 用例新增、编辑、删除、启停
- 预期行为配置
- 规则断言配置
- 参考答案维护
- Excel 导入导出
- 用例版本管理
- 回归用例集管理

### 5.4 quality-plan-service

负责测试计划。

核心能力：

- 测试计划模板
- 冒烟测试计划
- 全量回归计划
- 高风险专项计划
- RAG 专项计划
- 上线前验收计划
- 按应用、分类、标签、风险等级筛选用例

### 5.5 quality-execution-service

负责执行调度和结果采集，是平台核心服务之一。

核心能力：

- 创建执行批次
- 拆分执行任务
- 将任务投递到 Redis 队列
- 调用被测 AI 应用层接口
- 记录请求、响应、耗时、错误
- 维护执行状态
- 支持重跑失败用例
- 支持取消执行
- 根据应用适配器配置完成请求参数映射
- 根据响应映射规则抽取最终答案、引用来源、trace 信息和错误信息

执行服务不直接做复杂语义评分，只负责执行链路和原始结果沉淀。

由于被测 AI 应用层接口无法保证统一输入输出格式，执行服务不能硬编码单一调用协议。平台需要为每个 AI 应用维护“接口适配器配置”，包括请求构造、字段映射、响应抽取和错误识别规则。

### 5.6 quality-ai-service

负责 AI 评分和智能评估。

核心能力：

- 规则评分
- LLM Judge
- 分类评分模板
- 敏感风险评分
- 严谨问答评分
- RAG 评分接口预留
- Promptfoo / DeepEval / Ragas 集成预留
- 评分结果解释
- 模型供应商配置
- 评分模型配置
- 评分调用日志

AI 服务通过队列异步处理评分任务，避免长耗时评分阻塞执行链路。

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

### 5.7 quality-review-service

负责人工复核闭环。

核心能力：

- 待复核列表
- 人工判定
- 问题类型标记
- 需业务确认
- 需开发排查
- 加入回归用例
- 复核记录追踪

### 5.8 quality-statistics-service

负责统计和报告。

核心能力：

- 工作台统计
- 应用质量概览
- 分类通过率
- 平均分趋势
- 高风险失败统计
- 报告生成
- 报告导出

### 5.9 quality-system-service

负责系统基础能力。

核心能力：

- 用户管理
- 角色管理
- 菜单管理
- 权限控制
- 字典管理
- 操作日志

登录方式采用本地账号密码。第一阶段先做简单版本，不强制验证码、密码复杂度和首次登录改密，但数据模型和系统设置中预留后续增强空间。

### 5.10 接口适配器能力

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
- 引用来源字段路径
- traceId 字段路径
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
    "answerPath": "$.data.content",
    "traceIdPath": "$.data.traceId",
    "sourcesPath": "$.data.sources",
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

每个后端服务必须提供健康检查接口：

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
    "service": "quality-case-service",
    "status": "UP",
    "database": "UP",
    "redis": "UP",
    "time": "2026-05-18T00:00:00.000Z"
  }
}
```

前端增加“服务健康检查”页面，用于展示各服务状态、数据库状态、Redis 状态和最后检测时间，方便正式部署和联调排查。

前端健康检查页访问代理后的地址，例如：

```text
http://127.0.0.1:8080/ai-quality-platform/api/business/health.do
```

## 6. 前端页面规划

### 6.1 工作台

面向测试负责人和测试人员，展示平台总体质量状态。

核心内容：

- AI 应用数量
- 测试用例数量
- 本周执行批次
- 平均通过率
- 待复核数量
- 高风险失败数量
- 最近执行批次
- 待复核任务
- 低通过率应用

### 6.2 AI 应用管理

用于登记被测 AI 应用。

字段：

- 应用名称
- 应用编码
- 应用类型
- 业务领域
- 应用层接口地址
- 请求方式
- 认证方式
- 接口适配器配置
- 底层 Dify 应用
- 负责人
- 状态

### 6.3 测试用例管理

平台核心页面。

字段：

- 用例编号
- 用例名称
- 所属应用
- 用例分类
- 风险等级
- 用户问题
- 前置上下文
- 期望行为
- 必须包含关键词
- 禁止出现关键词
- 输出格式要求
- 参考答案
- 最低得分
- 是否需要人工复核
- 标签
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
- WARNING
- BLOCKED

### 6.6 人工复核中心

页面布局：

- 左侧：用例信息和用户问题
- 中间：AI 实际回答
- 右侧：预期要求、自动评分、评分理由
- 底部：人工判定、问题类型、备注、后续动作

人工判定：

- 通过
- 不通过
- 需业务确认
- 需开发排查
- 加入回归用例

### 6.7 评估报告中心

报告内容：

- 测试概览
- 测试对象
- 用例覆盖情况
- 总体通过率
- 分类通过率
- 高风险失败
- 典型失败案例
- 人工复核结论
- 整改建议
- 版本对比

## 7. 用例分类体系

第一版内置 10 类：

| 分类编码 | 分类名称 | 说明 |
| --- | --- | --- |
| NORMAL_QA | 常规问答 | 正常业务咨询 |
| STRICT_QA | 严谨问答 | 要求依据、边界、审慎表达 |
| WRONG_PREMISE | 错误前提 | 用户问题本身包含错误假设 |
| OUT_OF_SCOPE | 无关问题 | 与业务无关的问题 |
| SENSITIVE_RISK | 敏感风险 | 违规、绕规则、虚假材料等 |
| FUZZY_QUERY | 模糊问题 | 输入过短、指代不明 |
| MULTI_TURN | 多轮对话 | 上下文连续性 |
| FORMAT_OUTPUT | 格式输出 | JSON、Markdown、表格等 |
| RAG_QA | 知识库问答 | 依赖知识库检索 |
| EXCEPTION_STABILITY | 异常稳定性 | 空输入、超长输入、接口异常 |

分类不只是标签，还会关联默认期望行为、评分维度、复核策略和报告统计口径。

## 8. 执行链路

```text
测试人员选择计划
  -> 创建执行批次
  -> 查询计划命中的用例
  -> 生成执行任务
  -> 投递 Redis 队列
  -> execution-service 调用被测应用接口
  -> 保存原始请求响应
  -> 投递 AI 评分任务
  -> ai-service 执行规则评分和 LLM Judge
  -> 汇总最终状态
  -> 生成待复核任务
  -> statistics-service 汇总批次报告
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
- dify_app_id
- owner
- status
- created_at
- updated_at

### 9.2 测试用例表

`eval_case`

- id
- case_code
- case_name
- app_code
- category_code
- risk_level
- input_json
- expected_json
- reference_answer
- min_score
- manual_review_required
- tags
- enabled
- version
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
- pass_count
- fail_count
- review_count
- warning_count
- blocked_count
- avg_score
- started_at
- finished_at
- created_by

### 9.5 执行结果表

`eval_result`

- id
- run_code
- case_code
- app_code
- request_json
- response_json
- final_answer
- rule_score
- judge_score
- final_score
- pass_status
- failure_reason
- problem_type
- trace_id
- elapsed_ms
- error_code
- created_at

### 9.6 人工复核表

`eval_review`

- id
- result_id
- review_status
- manual_result
- problem_type
- review_comment
- next_action
- reviewer
- reviewed_at
- created_at

### 9.7 报告表

`eval_report`

- id
- report_code
- run_code
- report_name
- summary_json
- category_stats_json
- risk_stats_json
- typical_failures_json
- suggestion
- generated_at

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
POST /ai-quality-platform/case/import.do
POST /ai-quality-platform/case/export.do

POST /ai-quality-platform/plan/list.do
POST /ai-quality-platform/plan/create.do
POST /ai-quality-platform/plan/start.do

POST /ai-quality-platform/execution/run-list.do
POST /ai-quality-platform/execution/result-list.do
POST /ai-quality-platform/execution/rerun.do
POST /ai-quality-platform/execution/cancel.do

POST /ai-quality-platform/review/list.do
POST /ai-quality-platform/review/submit.do

POST /ai-quality-platform/report/list.do
POST /ai-quality-platform/report/detail.do
POST /ai-quality-platform/report/export.do
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
ai-quality-web
ai-quality-gateway
quality-business-service
quality-case-service
quality-plan-service
quality-execution-service
quality-ai-service
quality-review-service
quality-statistics-service
quality-system-service
mysql
redis
```

本地开发允许按需启动服务，但每个服务都要具备独立构建和独立部署能力。

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
   - Redis 连接
   - 统一配置
   - 统一 CORS
   - 统一 Gateway 入口规划
   - 健康检查接口
   - 服务健康检查页面

2. 登录和基础用户
   - 本地账号密码登录
   - 内置管理员账号：`admin`
   - 内置管理员默认密码：`admin123456`
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
   - 断言规则
   - 参考答案
   - 标签与风险等级

6. 测试计划管理
   - 计划列表
   - 新增、编辑、删除、启停
   - 按应用、分类、标签、风险等级筛选用例

7. 执行批次与 Redis 队列
   - 创建执行批次
   - 根据计划生成任务
   - Redis 队列执行
   - 执行状态维护
   - 取消执行
   - 重跑失败用例

8. 被测应用调用
   - 普通 JSON 响应调用
   - SSE 流式响应调用
   - 最终答案抽取
   - trace 信息抽取
   - 原始响应保存
   - 错误识别

9. 自动评分
   - 规则评分
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

12. 批次报告
    - 总体通过率
    - 分类通过率
    - 高风险失败
    - 典型失败案例
    - 整改建议
    - 报告详情页

13. Docker 本地部署脚本
    - 前端镜像
    - 后端服务镜像
    - MySQL 配置
    - Redis 配置
    - docker compose 本地启动

14. 演示种子数据
    - 内置 1 个演示 AI 应用
    - 内置 10 类用例分类
    - 内置 20 条左右演示测试用例
    - 内置 3 个演示测试计划
    - 内置 1 个可查看的历史执行批次
    - 内置基础报告样例
    - 内置示例被测服务，用于演示真实执行链路

暂缓：

- 多租户
- 复杂审批流
- 复杂 CI/CD 集成
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
10. 已确认本地端口由 Codex 统一规划，前端 3000，统一 Gateway 8080，各后端服务内部使用 3101-3108。
11. 已确认 Monorepo 使用 pnpm workspace。
12. 已确认第一阶段按功能逐个完整开发，不做半成品模块。
13. 已确认第一版接入 Excel 导入导出。
14. 已确认第一版内置一批演示 AI 应用、测试用例和测试计划种子数据。
15. 已确认 Excel 模板按平台完整字段设计。
16. 演示 AI 应用采用正式项目中的“示例被测服务”方式，不依赖外部真实 AI 应用，也不混入生产业务逻辑。

后续仍需确认：

1. 是否现在开始进入工程初始化阶段。
