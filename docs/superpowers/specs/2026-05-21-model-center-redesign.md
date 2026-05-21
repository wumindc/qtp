# 模型中心重构设计

## 背景

模型中心当前把“模型编码、用途、上下文窗口、温度”作为核心字段，无法表达真实供应商差异，也会让用户维护不该暴露的内部标识。模型新增表单在校验后会因错误文案撑开单个字段，造成左右列错位；这是全局表单规范缺失，不是单个页面样式问题。

## 目标

- 模型以数据库 `id` 作为唯一标识，不再暴露或保存 `modelCode`。
- 删除模型“用途”字段，模型中心只维护模型资产本身，不决定它用于评估、执行或复核。
- 模型能力拆成 `LLM` 与 `EMBEDDING`，后续可扩展 `RERANK`、多模态等能力。
- 按供应商类型和模型能力渲染不同参数，避免 OpenAI、DeepSeek、百炼/Qwen 共用一套粗糙表单。
- 统一表单校验规范，禁止浏览器原生校验气泡，错误提示出现后布局不能错位。
- 供应商与模型均支持测试连接；供应商测试端点连通，模型测试最小可调用请求。

## 信息架构

模型中心保留两个 Tab：

- 模型列表：展示平台可调用模型资产。
- 供应商列表：展示全局凭证、端点和启停状态。

供应商字段：

- 供应商名称
- 供应商类型：`OPENAI_COMPATIBLE`、`QWEN`、`DEEPSEEK`
- 接口地址
- API Key
- 状态

模型字段：

- 模型名称
- 所属供应商
- 模型能力：`LLM`、`EMBEDDING`
- 供应商模型 ID
- 协议：由供应商和模型能力自动推导，后续可开放高级模式手动调整
- 参数 JSON：按模型能力保存默认调用参数
- 能力 JSON：保存流式、JSON 输出、工具调用、推理、Embedding 等能力开关
- 限制 JSON：保存上下文、最大输出、Embedding 维度、超时等限制
- 状态

## 参数模板

`OPENAI_COMPATIBLE + LLM`：

- `temperature`
- `topP`
- `maxOutputTokens`
- `stream`
- `jsonMode`
- `toolCalling`
- `reasoning`
- `reasoningEffort`
- `timeoutMs`

`DEEPSEEK + LLM`：

- `temperature`
- `topP`
- `maxOutputTokens`
- `stream`
- `thinkingEnabled`
- `reasoningEffort`
- `timeoutMs`

DeepSeek 思考模式下采样参数可能受限，界面要用提示说明，不强制隐藏。

`QWEN + LLM`：

- `temperature`
- `topP`
- `topK`
- `maxOutputTokens`
- `stream`
- `jsonMode`
- `toolCalling`
- `thinkingEnabled`
- `timeoutMs`

`OPENAI_COMPATIBLE/QWEN + EMBEDDING`：

- `dimensions`
- `batchSize`
- `encodingFormat`
- `timeoutMs`

第一版 DeepSeek 不开放 Embedding 新增，因为官方主线能力以对话模型为主；如果用户选择 DeepSeek + Embedding，表单提示不支持。

## 表单规范

- 所有弹窗表单必须使用统一 Field 组件或统一 Field 样式。
- 表单使用 `noValidate`，由业务层或共享校验函数控制错误提示。
- 必填字段显示红色星号。
- 错误提示显示在字段下方，字段容器保留错误区高度，校验前后同一行控件不发生错位。
- 只读字段必须有明显底色、说明文案或禁用样式，不能只靠鼠标行为表达。
- `Input`、`Textarea`、`Select` 都必须支持统一的 `label`、`required`、`error`、`hint`。

## API 变化

- `model/update.do`、`model/change-status.do`、`model/test-connection.do`、`model/delete.do` 改为通过 `id` 操作。
- `model/create.do` 不再接收 `modelCode` 和 `purpose`。
- `model/list.do` 支持按 `providerCode`、`modelType`、`keyword` 查询。
- 保存模型时后端会验证供应商存在、模型能力合法、协议合法，并补齐默认参数。

## 验证范围

- Prisma schema 能成功推送到 MySQL。
- AI service 类型检查与单测通过。
- Web 类型检查、单测、构建通过。
- 健康检查通过。
- 浏览器验证：模型中心打开、供应商新增测试按钮可用、模型新增校验不出现原生气泡、错误后字段对齐、模型新增/启停/测试/删除基础流程可用。
