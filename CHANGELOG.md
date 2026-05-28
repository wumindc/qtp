# Changelog

## [未发布]

### 2026-05-28 — 引入 Framer Motion 全局重构登录页猫咪动画

#### 重构 — 基于物理弹簧系统解决动画裁切与冲突
- **变更需求**：用户反馈纯 CSS 实现的动画撕裂且看着不舒服，希望通过业界先进的动画框架打磨出极致平滑的动态视觉效果。
- **变更内容**：
  - `apps/web/package.json`：安装 `framer-motion` 库。
  - `apps/web/src/features/login/totoro-illustration.tsx`：废弃之前的纯 CSS `@keyframes` 结合 Tailwind 的粗糙动画实现，使用 `motion.div` 将龙猫动画引擎整体替换。采用物理弹簧（Spring）系统精细调节了小猫从屏幕底部“弹射入场”、点击密码框时的“缩起+爪子捂眼”、以及输入密码时的“偷看+瞳孔追踪”全套反馈。从根本上消除了因为复合 Transform 类引起的身体裁切（“挤扁”）、组件漂移和覆盖等一系列渲染 Bug，极大提升了动画的流畅感（Q弹感）。

### 2026-05-28 — 登录页增强：集成交互式卡通插画

#### 优化 — 基于开源库重写登录交互，提升视觉体验
- **变更需求**：用户提供了一个有趣的开源动效登录参考，要求我们集成到系统登录页中，实现输入账号时眼球跟随对视、输入密码时蒙眼等动态反馈。
- **变更内容**：
  - `apps/web/src/features/login/login-illustration.tsx`：参考 [marker964/animated-characters-login-page](https://github.com/marker964/animated-characters-login-page) 的 Vue 源码重新使用 React 实现了卡通人物，将其转变为交互组件。实现了 `mouseX/mouseY` 鼠标跟踪、`isTyping` 打字对视、`passwordLength` + `showPassword` 逻辑触发的偷看/闭眼交互。
  - `apps/web/src/features/login/login-form.tsx`：为 LoginForm 追加 `onTyping`, `onPasswordChange`, `onShowPasswordChange` 等状态回调，并添加了切换密码可见性的按钮。现在它通过 `useLoginAnimation` 自动从 Context 吸收动画状态，既能独立工作，也能与动画布局深度融合。
  - `apps/web/src/features/login/animated-login-layout.tsx`：重构原有的 `LoginView` 为更通用的 `AnimatedLoginLayout` 布局组件。采用全屏左右双栏布局（左侧 50% 显示插画，右侧 50% 渲染传入的 children 表单），并通过 Context API 向下透传动画联动所需的交互状态。
  - `apps/web/src/app/ai-quality-platform/login/page.tsx`：更新了页面布局，将其修改为完整的左右双栏响应式结构，并将 `LoginForm` 包装在 `AnimatedLoginLayout` 内渲染。

### 2026-05-28 — 服务健康页面体验优化

#### 优化 — 服务健康页面信息展示与网关耗时计算
- **变更需求**：用户反馈服务健康页面存在冗余信息（顶部 4 个统计卡片、公开 API 路由），且未在加载页面时自动触发检查。并且只有 Gateway 能够显示耗时（ms），其余服务缺失。部分服务无依赖或 Worker 时，展示了无意义的 `-` 占位符。
- **变更内容**：
  - `apps/web/src/features/health/health-page.tsx`：移除了顶部统计和路由模块，增加了 `useEffect` 以在组件挂载时自动触发检查，并优化了 `dependencyLine` 和 `workerLine` 的空状态判定以隐藏无效提示。
  - `apps/quality-gateway/src/health.controller.ts`：在聚合探针方法 `probeUrl` 中加入了基于 `performance.now()` 的请求耗时统计，将 `durationMs` 随下游微服务状态一同返回给前端。
  - `apps/web/src/features/health/hooks.ts`：更新前端响应解析，读取并透传各个服务的 `durationMs` 供界面展示。

### 2026-05-28 — 全局异常透传处理优化

#### 优化 — 全局拦截底层 Error 异常，将业务错误透传到前端界面
- **变更需求**：目前系统大量抛出 `throw new Error('执行结果记录缺少用例快照 JSON')` 这类底层错误，NestJS 默认会拦截为 500 并屏蔽掉 `message` 内容。前端只能提示“内部服务器错误”，用户无法直接知道出错原因，排查成本高。
- **变更内容**：
  - `packages/shared-http/src/global-exception.filter.ts`：实现全局异常过滤器，拦截所有未知异常。对于 `Error` 类型的抛出，直接将其 `.message` 信息转换成前端所认识的 `ApiResponse` 结构，将错误细节作为 `message` 透传。
  - `packages/shared-http/tsconfig.json`：打开了由于引用 `@nestjs/common` `ExceptionFilter` 所需的装饰器开关 `experimentalDecorators` 和 `emitDecoratorMetadata`。
  - `apps/quality-platform-service/src/main.ts`、`apps/quality-execution-service/src/main.ts`、`apps/quality-gateway/src/main.ts`、`apps/quality-ai-invocation-service/src/main.ts`：全部引入并注册该全局过滤器。
  - `apps/web/src/components/ui/sonner.spec.tsx`：修复因为前期解决 Toast 位置偏右而移除 `max-content` 导致的测试失败，实现 113 个全量测试 100% Pass。

### 2026-05-28 — 工作台统计接口认证修复

#### 修复 — 工作台首页报 401 / 404
- **变更需求**：工作台首页依次出现 401"未登录或登录已过期"和 404；同时统一请求方式原则不能破。
- **根因**：
  1. `loadDashboardMetrics()` 原用裸 `fetch` 无认证头 → 401。
  2. 后端 `report.controller.ts` 用 `@Get`，`postGateway` 发 POST → 404。
- **修复方案（改后端而非破坏前端统一性）**：
  - `apps/quality-platform-service/src/modules/report/report.controller.ts`：将 `@Get('dashboard.do')` 改为 `@Post('dashboard.do')`，与全项目所有其他接口保持一致。
  - `apps/web/src/features/dashboard/dashboard.tsx`：使用 `postGateway('statistics', '/report/dashboard.do')` 统一调用，自动携带 Authorization token。
  - `apps/web/src/features/dashboard/dashboard.spec.tsx`：fetch stub 格式改为 `{ok: true, success: true, data: {...}}`，与 `postGateway` 解析逻辑匹配。




#### 修复 — Toast 偏右 + 协议字段缺失阻断列表加载
- **变更需求**：1) Toast 显示位置偏右，应居中；2) 后端日志有详细错误信息但前端只看到通用错误；3) 应用协议字段缺失不应影响列表展示，应进入详情页再配置。
- **变更内容**：
  - `apps/web/src/components/ui/sonner.tsx`：移除 `width: max-content` 和 `--width: max-content` 覆盖，sonner 的 `top-center` 定位依赖内部固定宽度（默认 356px）才能正确水平居中，覆盖 `--width` 后容器宽度变为内容自适应导致居中计算失效；保留 `maxWidth` 约束即可。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`：将 `toRecord()` 中对 `adapterConfig.*`（`execution`/`templates`/`response`/`ui`）的 `readRequiredRecord` 改为 `readOptionalRecord`（缺失时返回空对象），对协议模板/路径/表达式缺失改为回退到默认常量，避免旧格式或未配置协议的数据库记录导致整个应用列表接口报 500。核心标识字段（`appCode`/`appName`/`status`/`icon`）保持严格校验。
  - `apps/quality-platform-service/src/modules/app/app.service.spec.ts`：更新源码卫生测试，允许 `toRecord` 对协议字段使用默认值回退，保留对核心标识字段和评估配置字段的强转禁止。



#### 修复 — 应用列表加载失败时 toast 重复弹出、错误信息不友好
- **变更需求**：应用列表页报错时显示两条"Internal server error"，无法知晓真正原因。
- **变更内容**：
  - `apps/web/src/features/apps/app-list.tsx`：`refresh` 函数接收 `AbortSignal`，在 `useEffect` 中通过 `AbortController` 防止已卸载组件更新状态；`toast.error` 增加固定 `id: 'app-list-load-error'`，sonner 会对同 id 的 toast 去重，解决 React StrictMode 下 effect 执行两次导致两条重复 toast 的问题；`getErrorMessage` 扩展为同时读取非 `Error` 对象的 `message` 字段。
  - `apps/web/src/lib/api/gateway-client.ts`：当后端返回的 `message` 为空或匹配 `internal server error`（大小写不敏感）时，将通用英文错误替换为中文提示并附上请求路径（如"服务器内部错误（/app/list.do），请联系管理员或稍后重试"），方便用户定位是哪个接口出了问题。
  - `apps/web/src/features/apps/app-list.spec.tsx`：更新测试断言，匹配 `toast.error` 新调用签名（带 `id` 选项）。



#### 重构 — 登录页全面使用语义化主题 token，内嵌主题切换
- **变更需求**：用户反馈登录页在亮色模式下卡片背景颜色突兀，标题文字不清晰，且没有主题切换入口。
- **变更内容**：
  - `apps/web/src/features/login/login-form.tsx`：完全重写，所有颜色改为语义化 token（`bg-card`、`text-card-foreground`、`bg-background`、`text-foreground`、`bg-primary` 等），自动跟随亮/暗主题；标题和图标移入卡片内部，消除对比度问题；新增内嵌 `ThemeButton` 组件（右上角），复用 `next-themes` `useTheme`，通过 DropdownMenu 切换浅色/深色/跟随系统。
  - `apps/web/src/app/ai-quality-platform/login/page.tsx`：背景改为 `bg-background` 语义 token，光晕装饰极淡（opacity 5-7%），在亮色和暗色下均不突兀。


#### 重构 — 登录页面从简陋表单升级为现代化玻璃态设计
- **变更需求**：用户反馈登录页面过于简陋，需要重新设计视觉并确保真实登录功能正常。
- **变更内容**：
  - `apps/web/src/features/login/login-form.tsx`：完全重写登录表单，采用现代卡片布局；新增 Logo 图标区域（Sparkles 图标 + 圆角方块）、彩色渐变顶部装饰条、带图标的输入框（User/Lock 图标前缀）、清晰的错误提示块（AlertCircle 图标 + 红色高亮边框）、加载状态（Loader2 旋转动画 + 按钮禁用）；保留并优化真实登录逻辑（`postGateway` + `saveAuthSession`），空表单前端校验拦截避免发空请求；状态机管理 `idle/loading/error/success` 四态。
  - `apps/web/src/features/login/login-form.tsx`：登录按钮文案统一为“登录”，与测试断言和正式页面文案保持一致，不再保留开发期空格排版。
  - `apps/web/src/app/ai-quality-platform/login/page.tsx`：重写登录页背景，新增紫蓝渐变光晕（顶部蓝色 + 右下紫色 oklch 径向渐变）、45°微格网格装饰层（低不透明度）、两个大光晕圆点模糊装饰；补充 SEO metadata（`title/description`）；保持登录页在 `PlatformLayout` 之外独立渲染。

### 2026-05-28 — 应用协议请求头安全边界加固

#### 安全 — 拒绝危险请求头透传，双链路统一校验
- **变更需求**：协议测试与执行调用都支持用户维护 headerTemplate，必须阻断危险/控制类请求头并统一标准。
- **变更内容**：
  - `packages/shared-config/src/index.ts`：新增 `validateApplicationRequestHeaders` 与 `normalizeApplicationRequestHeaders`，统一校验 header 名称、禁止空名/非法字符/禁用头（如 `Connection`、`Host`、`Transfer-Encoding` 等）。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`：协议测试阶段改为使用共享 header 规范化函数。
  - `apps/quality-execution-service/src/execution.service.ts`：执行调用阶段改为使用共享 header 规范化函数。
  - `packages/shared-config/src/config.spec.ts`、`apps/quality-platform-service/src/modules/app/app.service.spec.ts`、`apps/quality-execution-service/src/execution.service.spec.ts`：新增禁用 header 与非法 header 测试，确保校验失败时不发起真实调用。

### 2026-05-27 — 上线前无用与临时产物清理

#### 删除/清理 — 移除旧 UI 方案、工具过程产物和未引用前端层
- **变更需求**：用户要求上线前深入审核全部代码，清理无用、冗余、兼容、重复、废弃、临时、虚拟和不真实的代码与产物。
- **变更内容**：
  - `.codex/skills/semi-ui-skills`、`.superpowers/brainstorm`、`docs/superpowers/*`、`docs/semi-frontend-standards.md`：删除已废弃的 Semi/HeroUI/脑暴/实施计划过程产物，避免与当前 Radix + shadcn 风格主线冲突。
  - `.gitignore`：新增 `.codex/`、`.superpowers/`、`docs/superpowers/`，防止后续工具过程产物重新进入仓库。
  - `apps/web/src/components/console/*`：删除未被页面引用且不符合当前 Tailwind-only 规范的旧 Console 组件。
  - `apps/web/src/app/providers.tsx`、`apps/web/src/lib/api/query-client.ts`、`apps/web/src/features/models/model-center-queries.ts`：删除 TanStack Query POC 残留层；当前页面均走显式 API 调用和本地状态。
  - `apps/web/src/features/apps/types.ts`、`apps/web/src/features/models/types.ts`、`apps/web/src/features/apps/api/plan-execution-api.ts`：删除未引用的旧评估/执行类型、前端过滤历史函数和多余导出。
  - `apps/web/src/components/ui/*`：收窄当前未使用的 UI 基础组件导出，删除旧版导出名称 `DropdownMenuRoot`，不再保留未使用兼容别名。
  - `apps/web/src/app/api/proxy/route.ts`、`apps/web/src/features/apps/app-protocol.tsx`、`apps/quality-platform-service/src/modules/app/*`：删除前端任意 URL 调试代理，接口测试统一走后端 `/app/protocol/test.do`，并支持测试未保存的当前表单配置和流式响应提取。
  - `apps/web/src/features/apps/protocol-template.ts`：删除仅服务于前端代理的模板渲染工具，协议模板统一由后端服务渲染。
  - `packages/ai-invocation-contract`、`packages/ai-invocation-client`、`packages/ai-model-adapter`、`apps/quality-ai-invocation-service/src/model-invocation.controller.ts`：把纯 AI 调用请求/响应契约、usage 归一和失败结果结构从供应商协议 SDK 中拆出，`ai-invocation-client` 不再依赖 `ai-model-adapter`，业务服务只通过内部客户端和纯契约调用 AI invocation service。
  - `packages/ai-invocation-client`、`apps/quality-platform-service/src/modules/provider/*`、`apps/quality-execution-service/src/execution.service.ts`：模型中心供应商模型发现、模型测试与执行评估统一通过内部 AI 调用客户端；platform/execution 不再直接或间接依赖 `packages/ai-model-adapter`，避免业务服务继续拼装供应商协议请求。
  - `packages/ai-invocation-contract`、`packages/ai-model-adapter`、`apps/quality-platform-service/src/modules/provider/*`、`apps/quality-execution-service/src/execution.service.ts`：AI 调用契约新增抽象 `providerKind`，platform/execution 只传 `enableThinking` 这类能力开关；Qwen 的 `enable_thinking` 与 DeepSeek 的 `thinking.type` 供应商字段统一由 AI invocation 边界内的 adapter 翻译。
  - `packages/ai-invocation-contract`、`packages/ai-model-adapter`、`scripts/check-topology.mjs`：删除 AI 调用契约中的 `providerOptions` 万能供应商透传口，`reasoningEffort` 从 `unknown` 收窄为显式枚举；adapter 不再把任意 provider option 或非法 reasoning 值透传到供应商请求体。
  - `apps/quality-platform-service/src/modules/provider/*`：模型中心供应商连接测试和模型测试不再在 platform 拼装或回显 `/models`、`/chat/completions`、`/embeddings` 等供应商 wire endpoint；platform 只校验供应商 baseUrl 形状并通过内部 AI invocation client 发起探测，供应商路径细节仅保留在 AI invocation/adapter 边界。
  - `docs/20260527-005-生产部署拓扑与开发运行标准.md`：生产拓扑图补充 `quality-ai-invocation-service`、`ai-invocation-contract`、`ai-invocation-client`、`ai-model-adapter` 与外部模型供应商边界，明确 AI 调用运行时、纯契约、内部客户端与协议 SDK 的分工。
  - `packages/shared-database/prisma/schema.prisma`、`packages/shared-database/src/clear-business-data.ts`：删除废弃的 `eval_case_suite` 表模型和清理逻辑。
  - `apps/quality-platform-service/src/modules/case/*`：删除未被真实前端和执行计划使用的 `/case/suite/**`、`/case/import.do`、`/case/preset/import-to-app.do` 以及相关服务逻辑；预置用例复用统一走分类订阅。
  - `apps/quality-platform-service/src/modules/case/*`、`apps/web/src/features/cases/api/case-api.ts`：用例创建/更新请求收敛为 `categoryId/query/expectedBehavior/enabled`，移除 `categoryCode/caseCode/code` 等旧兼容别名。
  - `apps/quality-platform-service/src/modules/plan/*`、`apps/quality-execution-service/src/execution.service.ts`、`apps/web/src/features/apps/app-plans.tsx`：移除计划筛选中的隐藏 `riskLevels` 条件，执行计划只按应用、分类和显式选中用例筛选。
  - `apps/quality-platform-service/src/modules/provider/scoring.service.*`：删除未接入真实执行链路的规则评分 POC，评估统一由 execution service 编排并通过 AI invocation 边界调用模型。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/report/*`：删除不真实的 `eval_report` 报告快照表和报告生成/导出/详情端点，仅保留真实工作台统计接口。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/case/*`、`apps/quality-platform-service/src/modules/plan/*`、`apps/quality-execution-service/src/execution.service.ts`：删除未被当前链路使用的用例风险/参考答案/最低分/人工复核标记/标签/版本字段、运行 warning/block 计数字段和结果 rule/judge 双评分字段。
  - `packages/shared-database/prisma/schema.prisma`、`packages/shared-database/src/seed.ts`、`apps/quality-platform-service/src/modules/case/case.service.ts`、`apps/quality-platform-service/src/modules/plan/plan.service.ts`、`apps/quality-execution-service/src/execution.service.ts`、`apps/web/src/features/apps/api/plan-execution-api.ts`：删除 `eval_case.caseName` 及对应接口/快照字段，用例主模型只保留分类、问题、期望回答和启停状态，执行展示直接使用问题内容。
  - `apps/quality-execution-service/src/execution.service.ts`、`apps/web/src/features/apps/*`：删除从旧版 `_RUN_` 编码解析执行时间的兼容逻辑，执行排序和展示只使用数据库返回的 `startAt/endAt`。
  - `docs/20260526-001-执行历史详情页设计.md`、`docs/20260526-002-真实执行闭环实施计划.md`、`docs/20260526-003-应用评估配置实施计划.md`、`docs/20260526-004-执行评估两阶段与计费审计计划.md`、`docs/20260526-005-执行详情语义与历史快照修复计划.md`：删除已经被当前架构取代的历史实施稿，避免旧独立服务、旧字段和 mock 初期设计继续误导上线判断。
  - `apps/quality-platform-service/src/health.controller.ts`、`docker-compose.yml`、`docker-compose.dev-deps.yml`、`.env.example`、`scripts/check-topology.mjs`、`docs/*`：删除未被当前业务链路使用的 Redis 运行依赖、健康探测和环境变量，当前执行 Worker 以 MySQL 持久化状态为准。
  - `docs/20260527-006-上线前代码清障审计.md`：新增清障审计记录，沉淀已清理项、自动化证据和下一批数据库/兼容逻辑/安全边界审计重点。
  - `apps/web/package.json`、`apps/quality-platform-service/package.json`、`package.json`、`pnpm-lock.yaml`：移除未直接使用的 `@tanstack/react-query`、`jsonpath-plus`、`geist`、platform-service 重复 Prisma 依赖和根级重复 `vitest` 依赖。
  - `packages/shared-database/package.json`：移除未直接导入的 `mariadb` 依赖，MariaDB 驱动由 Prisma adapter 自身依赖提供。
  - `apps/quality-platform-service/src/modules/app/app.controller.ts`：修正残留的 Semi 页面注释，改为正式工作区详情页语义。
  - `apps/quality-ai-invocation-service`、`packages/ai-invocation-client`：补齐内部 AI 调用运行时服务边界，platform 的供应商模型发现、模型测试和 execution 的评估调用不再直接访问外部模型供应商；外部供应商调用集中到 AI invocation service，协议细节由 `packages/ai-model-adapter` 承担。
  - `packages/ai-model-adapter`：补齐 Embedding 调用标准，统一 Chat 与 Embedding 的请求体、供应商错误码和响应结构。
  - `docker-compose.yml`、`.env.example`、`package.json`、`scripts/check-health.mjs`、`scripts/check-topology.mjs`、`apps/web/src/features/health/*`：运行拓扑增加 `quality-ai-invocation-service`，开发环境 Node 暴露 3105 调试端口，生产环境仍只暴露 nginx 最终入口。
  - `packages/shared-auth`、`packages/shared-database/src/seed.ts`、`apps/quality-platform-service/src/modules/auth/*`、`apps/quality-gateway/src/gateway.controller.ts`、`apps/web/src/features/login/login-form.tsx`：删除 `admin/admin123456` 和 `local-admin-token-*` 假登录链路，管理员初始密码改为环境变量显式 seed 后哈希入库，gateway 对业务 API 校验签名 token。
  - `docker-compose.yml`、`docker-compose.dev-deps.yml`、`.env.example`、`packages/shared-database/src/seed.ts`、`scripts/check-topology.mjs`：删除生产 root/root 数据库连接，MySQL root 密码和应用库账号/密码改为显式环境变量，开发默认账号收敛为 `qtp_app`。
  - `packages/shared-config/src/index.ts`、`apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：新增被测应用调用地址策略，开发 Node 允许本机和局域网联调，生产默认阻止 `localhost`、回环地址、内网 IP 和 Docker 内部服务名，协议测试与执行计划共享同一策略。
  - `docker-compose.yml`、`.env.example`、`scripts/check-topology.mjs`、`docs/20260527-005-生产部署拓扑与开发运行标准.md`、`docs/20260527-006-上线前代码清障审计.md`：生产容器显式设置 `NODE_ENV/QTP_RUNTIME_ENV=production`，并通过 `QTP_ALLOWED_APP_INVOKE_ORIGINS` 只放行明确配置的受控内网被测系统。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/review/*`、`apps/quality-platform-service/src/modules/report/report.service.ts`、`apps/web/src/features/apps/api/plan-execution-api.ts`：删除 `eval_review.reviewStatus/problemType/nextAction/reviewer` 等没有真实工作流来源的字段，前端不再提交硬编码审阅人；工作台待复核数改为从当前执行结果和最新人工结论实时计算。
  - `apps/web/src/features/models/api/model-center-api.ts`、`apps/web/src/features/apps/api/app-api.ts`：删除前端对 `parametersJson/capabilitiesJson/limitsJson`、旧 `protocol` 对象和平铺统计字段的兼容读取；模型中心和应用列表只消费当前后端公开字段。
  - `apps/quality-platform-service/package.json`、`apps/quality-execution-service/package.json`、`packages/ai-invocation-client/package.json`、`scripts/check-topology.mjs`：补齐 AI 调用抽象红线检查，禁止 platform/execution 与 invocation client 依赖 `@ai-quality-platform/ai-model-adapter`，模型协议 SDK 只在 AI invocation 边界内暴露。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/web/src/features/apps/app-form-dialog.tsx`、`apps/web/src/features/apps/types.ts`：应用类型收敛为当前真实可用的 `CHAT`，后端拒绝 `CHATBOT/WORKFLOW` 等旧值或未实现类型，前端不再展示“工作流待开发”的虚拟选项。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/provider/provider.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：`ai_model` 表 JSON 字段从 `parametersJson/capabilitiesJson/limitsJson` 重命名为 `parameters/capabilities/limits`，数据库、Prisma schema 和服务映射与公开模型契约保持一致。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/provider/provider.service.ts`：`ai_model.parameters/capabilities/limits` 改为必填 JSON 字段；创建模型和测试未保存模型时必须提交显式配置对象，后端不再把缺失配置补成 `{}`。
  - `apps/quality-platform-service/src/modules/report/report.service.ts`、`apps/web/src/features/dashboard/dashboard.tsx`：工作台失败批次指标从 `highRiskFailureCount`/“风险执行”改为 `failedRunCount`/“未达标批次”，移除已删除风险等级字段带来的虚假语义。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`：删除应用协议契约中的 `requestSchema/responseSchema` 虚拟元数据，并把应用创建/更新改为显式字段白名单，避免旧字段、临时字段或前端多余字段穿透进应用记录。
  - `packages/shared-database/prisma/schema.prisma`、`packages/shared-database/src/seed.ts`、`apps/quality-platform-service/src/modules/app/app.service.ts`：删除 `ai_app.businessDomain` 占位字段；当前应用创建页、列表、概览、执行链路均不使用业务域，首次上线不保留默认“未分类”这类虚拟分类字段。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-execution-service/src/execution.service.ts`、`apps/quality-platform-service/src/modules/review/review.service.ts`：删除 `eval_plan.createdBy`、`eval_run.createdBy/runName/costCalculatedAt` 和 `eval_review.reviewedAt` 等未被真实用户链路读写或重复的数据库字段，执行批次不再写入重复 runName，人工修订只保留 `createdAt` 作为记录时间。
  - `apps/quality-gateway/src/health.controller.ts`、`apps/web/src/lib/api/gateway-client.ts`、`apps/web/src/features/health/hooks.ts`：删除健康聚合与前端 gateway client 中把非法 JSON 吞成 `{}` 的兜底；内部服务或 gateway 返回坏 JSON 时明确标记失败并显示错误消息。
  - `apps/web/src/features/health/hooks.ts`：健康页不再把 execution worker 诊断缺失字段兜底成 0；execution 返回 `UP` 但缺少 `runningRunCount/activeRunCount` 时前端标记为异常并显示缺失字段原因。
  - `apps/quality-gateway/src/gateway.controller.ts`：gateway 转发 POST/PUT/PATCH/DELETE 请求时不再把缺失请求体合成为 `{}`；只有调用方真实提交 body 时才设置 JSON body 和 `Content-Type`，避免调用方错误被包装成有效空请求。
  - `apps/quality-platform-service/src/modules/app/app.controller.ts`：应用列表接口不再把缺失查询 `data` 包装成空对象，协议测试接口不再把缺失 `sampleInput` 包装成空输入；调用方必须显式提交查询对象和测试输入，协议覆盖配置仍保持可选。
  - `apps/quality-platform-service/src/modules/plan/plan.controller.ts`、`apps/quality-platform-service/src/modules/provider/provider.controller.ts`、`apps/quality-execution-service/src/execution.controller.ts`：计划列表、模型列表和执行记录列表不再把缺失 `data` 包装成空查询，缺字段会直接报错，避免后端故障或调用方坏请求被展示成空列表。
	  - `apps/quality-execution-service/src/execution.service.ts`：执行用例筛选不再把缺失的预置分类订阅数据源当成空订阅列表；执行服务必须能够读取应用订阅的系统预置分类，否则直接失败，避免漏跑预置用例还生成正常完成批次。
	  - `apps/quality-platform-service/src/modules/case/*`：用例列表、分类列表、预置列表和 CSV 导入接口不再把缺失的 `data` 或 `rows` 包装成空对象/空数组；调用方必须显式提交查询对象和导入行数组，避免坏请求被显示成空列表或“导入 0 条”。
	  - `apps/quality-platform-service/src/modules/case/*`：应用关联系统预置分类时不再把缺失的 `categoryIds` 包装成空数组；缺字段会明确报“缺少系统预置分类列表”，显式空数组才表示用户未选择分类。
	  - `apps/quality-platform-service/src/modules/plan/plan.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：执行计划预览、启动和执行用例筛选不再把缺失的 `caseFilter` 包装成 `{}`；坏计划会明确报“执行计划缺少用例筛选条件”，避免被执行成 0 条用例的正常完成批次。
	  - `apps/quality-platform-service/src/modules/plan/plan.service.ts`：计划服务读取 MySQL 计划和预览用例时不再把缺失字段用 `String(...)` 强转为空值、把坏 `caseFilterJson` 转成 `{}`、或把非法状态默认成启用；坏持久化记录会直接失败。
	  - `apps/web/src/features/apps/app-overview.tsx`、`apps/web/src/features/apps/use-plan-runs.ts`、`apps/web/src/features/apps/app-plans.tsx`、`apps/web/src/features/apps/app-history-detail.tsx`：删除概览、计划页和执行详情页把接口失败转成空列表或合成执行版本的伪数据路径；主数据加载失败直接展示错误，分类加载失败保留计划列表但提示真实错误。
	  - `apps/web/src/lib/api/gateway-client.ts`、`apps/web/src/features/apps/api/plan-execution-api.ts`、`apps/web/src/features/apps/app-cases.tsx`、`apps/web/src/source-hygiene.spec.ts`：列表响应必须包含正式 `list` 数组，执行版本和重新评估响应必须是数组，执行状态查询失败不再返回 `null`；应用用例页加载失败展示错误态，不再显示“暂无用例”。
		  - `apps/web/src/features/apps/api/app-api.ts`：应用列表/详情映射不再把缺失或非法的应用类型、状态、请求方法、协议配置、执行并发和统计字段默认成 `CHAT/ENABLED/POST/3/0`；协议详情也不再用本地默认模板兜底，坏契约直接报错。
		  - `apps/web/src/features/apps/app-view-contract.ts`、`apps/web/src/features/apps/app-list.tsx`、`apps/web/src/features/apps/app-overview.tsx`：应用列表和应用概览在渲染前再次校验应用协议与统计信息，不再把缺失 `protocol/stats` 的应用显示成 `POST 未配置接口`、0 用例、0 计划或默认协议配置。
		  - `apps/web/src/features/apps/api/app-api.ts`：应用列表/详情映射不再把非字符串的应用编码、名称、描述、负责人、创建时间、更新时间或最近执行时间用 `String()` 强转成正常字段；可选文本字段只允许缺失或真实字符串。
		  - `apps/web/src/features/apps/api/app-evaluation-api.ts`、`apps/web/src/features/apps/app-evaluation.tsx`：评估配置和评估模型列表不再把缺失模型 ID、空系统提示词、缺失模型类型、空供应商或丢失供应商关系包装成可用配置；未配置应用也不再自动选择第一条模型，必须由用户显式保存真实评估模型。
		  - `apps/web/src/features/cases/api/case-api.ts`：预置分类和预置用例列表映射不再读取旧 `code/categoryName/input` 别名，也不再把缺失 ID、分类名称、问题内容、期望回答或启停状态转成空字符串/默认启用；坏契约直接报错。
		  - `apps/quality-platform-service/src/modules/case/case.service.ts`：用例分类公开契约删除 `code` 旧别名，创建用例不再通过 seed 风格构造器把缺失 `appCode/categoryId/query/expectedBehavior` 补成空字符串；坏请求会明确报缺少应用编码、分类、问题内容或期望回答。
		  - `apps/web/src/features/apps/app-cases.tsx`：应用用例页不再直接把 gateway 列表结果强转成分类/用例结构；分类、用例、预置订阅和预置关联响应都按当前公开字段显式校验，坏响应进入页面错误态。
		  - `apps/quality-platform-service/src/modules/case/case.service.ts`：用例数据库读取层不再过滤畸形分类/用例/订阅行，也不再把缺失字段兜底为空字符串、默认启用或默认 APP 范围；MySQL 记录缺少正式字段会直接报错。
		  - `apps/quality-platform-service/src/modules/report/report.service.ts`：工作台统计不再把畸形执行批次和人工复核记录兜底为 0、空 ID 或默认排序；执行批次、执行结果、人工复核来源字段缺失时直接失败，避免服务异常被展示成平静的 0 指标。
			  - `apps/quality-platform-service/src/modules/app/app.service.ts`：应用接口协议请求方法收窄为当前真实支持的 `GET/POST`，保存协议或临时测试协议时不再接受 `PUT/PATCH` 或把非法方法默认成 `POST`；读取持久化应用协议时也不再给缺失的模板、答案路径、成功条件或流式配置套默认值。
				  - `apps/quality-platform-service/src/modules/app/app.service.ts`：应用服务读取 MySQL 应用与评估配置时不再把缺失字段强转成字符串、把非法状态默认启用、把缺失模型 ID/提示词覆盖开关/并发数包装成可用配置；坏持久化记录会直接失败。
				  - `apps/quality-platform-service/src/modules/app/app.service.ts`：应用统计来源不再静默过滤畸形预置分类订阅，也不再把缺失最近执行记录字段兜底成 0 或无最近执行时间；最近执行记录缺少总数、通过数或开始时间会直接失败。
				  - `apps/quality-platform-service/src/modules/app/*`、`apps/web/src/features/apps/*`：应用图标读取不再按 `appCode/appName` 稳定生成兼容图标；持久化应用和前端应用列表必须携带真实 `iconKey/themeKey/variantKey`，坏图标配置直接失败。
				  - `apps/quality-execution-service/src/execution.service.ts`：执行服务读取持久化应用协议时不再给缺失的请求模板、答案路径或成功条件套默认值，执行前也会拒绝非 `GET/POST` 请求方法，坏协议进入明确失败结果。
			  - `apps/quality-execution-service/src/execution.service.ts`：执行服务读取持久化应用协议时不再把应用编码、应用名称和调用地址用 `String(...)` 强转，也不再把缺失调用地址补成空字符串；坏协议记录会直接失败。
		  - `apps/web/src/features/apps/use-plan-runs.ts`、`apps/web/src/features/apps/use-plan-runs.spec.ts`：执行计划分类加载不再使用本地 `readList()` 把坏网关列表响应转成空分类，统一复用严格 `readGatewayList()`，分类接口坏响应会走明确错误提示。
	  - `apps/web/src/features/models/api/model-center-api.ts`、`apps/web/src/features/models/index.tsx`：删除模型中心 gateway 列表加载失败时返回空供应商/空模型的假数据路径，加载失败改为页面错误提示并保留明确异常。
		  - `apps/web/src/features/models/api/model-center-api.ts`、`apps/quality-platform-service/src/modules/provider/provider.service.ts`：模型中心不再把未知供应商类型、模型类型、协议或缺失供应商关系默认成 OpenAI 兼容/LLM；坏契约直接报错，避免错误模型配置被包装成可用配置。
		  - `apps/web/src/features/models/api/model-center-api.ts`：模型中心供应商/模型映射不再把缺失的 `providerCode/providerName/baseUrl/id/modelName/modelId` 转成空字符串记录；后端响应缺少必填字符串时直接报错。
		  - `apps/web/src/features/models/api/model-center-api.ts`：模型中心供应商/模型映射不再把缺失 `enabled` 默认成启用，也不再把缺失或畸形的 `parameters/capabilities/limits` 强转成空对象；坏响应直接进入页面错误态。
		  - `apps/quality-platform-service/src/modules/provider/provider.service.ts`：模型供应商和模型数据库读取层不再把缺失的供应商编码、接口地址、模型 ID、数据库 ID 或启停状态转成空字符串/默认启用；可选 JSON 配置只允许空值或对象，坏数据库记录会直接失败。
		  - `apps/web/src/features/models/model-center-schema.ts`：模型保存/测试 payload 不再把非法上下文窗口、最大输出 Token、向量维度或计费价格静默兜底成 `128000/4096/undefined`；坏数值会明确报错，避免错误模型配置被伪装成默认配置。
		  - `apps/web/src/features/models/models-panel.tsx`、`apps/web/src/source-hygiene.spec.ts`：模型中心编辑已有模型时不再把缺失的上下文窗口、最大输出 Token、流式/JSON/工具/思考能力补成 `4096/true/false`；坏模型记录不会被本地编辑表单包装成可保存配置。
	  - `apps/web/src/features/dashboard/dashboard.tsx`：删除首页工作台 `EMPTY_METRICS` 和 `Promise.allSettled` 局部空数据兜底；统计、应用和最近执行任一主链路加载失败时显示“工作台加载失败”，不再用 0 指标或“暂无执行记录”掩盖故障。
	  - `apps/web/src/features/dashboard/dashboard.tsx`：工作台统计响应不再把缺失或非法指标兜底成 0，重点关注应用不再把缺失 `stats` 渲染成 0 用例/0 计划；坏统计响应直接进入加载失败。
	  - `docs/20260527-002-服务架构收敛设计.md`、`docs/20260527-004-服务架构收敛后续优化目标.md`：修正旧 `quality-ai-service` 归并和“三服务拓扑”表述，明确最终后端运行单元包含 gateway/platform/execution/AI invocation，AI 模型调用运行时必须独立抽象为内部服务。
	  - `apps/web/src/features/apps/api/app-api.spec.ts`、`apps/web/src/features/models/api/model-center-api.spec.ts`：删除只为旧响应字段设计的前端兼容测试数据，测试集只保留当前公开契约。
  - `apps/quality-platform-service/src/modules/case/*`、`apps/quality-platform-service/src/modules/plan/*`、`apps/quality-platform-service/src/modules/provider/*`：创建/更新用例、分类、执行计划、模型供应商和模型配置时统一改为显式字段白名单，不再把请求体额外字段透传到服务记录或接口响应。
  - `apps/quality-platform-service/src/modules/provider/*`、`apps/web/src/features/models/*`：模型供应商公开列表和保存响应不再返回明文 API Key，仅返回 `apiKeyConfigured`；编辑供应商时 API Key 留空会保留已保存密钥，避免前端长期持有或误提交空密钥覆盖生产配置。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/web/src/features/apps/api/app-api.ts`：应用负责人保留为真实可选字段，不再在后端创建或前端保存/映射时注入 `system` 这类虚拟默认值；未设置负责人保持为空，由页面展示“未设置”。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`、`apps/web/src/features/apps/*`：应用接口协议模板统一使用 `{{case.input.query}}`，移除旧 `{{case.query}}` 兼容解析，并禁止执行阶段通过模板向被测应用暴露 `expectedBehavior` 期望答案。
  - `packages/shared-database/prisma/schema.prisma`、`apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：删除 `ai_app.authType/authConfig` 隐藏鉴权字段和自动注入请求头逻辑，应用接口调用只以页面真实维护的 `headerTemplate` 为准，避免两套鉴权来源和隐藏密钥回显。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：收紧应用接口成功条件表达式，非空表达式必须是受支持的 `$.path == value` 且真实命中；不再把不支持的表达式或“答案非空”兜底当成调用成功。
  - `apps/quality-execution-service/src/execution.service.ts`：执行恢复和批次统计只认 `appStatus/evaluationStatus` 的正式终态，不再把缺少阶段字段但已有答案或 `passStatus` 的旧结果当作已完成、可统计结果。
  - `apps/quality-execution-service/src/execution.service.ts`：执行结果详情、重跑和恢复不再从 `requestJson`、`inputJson/expectedJson` 或结果顶层字段反补分类、问题和期望回答；`caseSnapshotJson` 必须具备当前正式 `categoryId/question/expectedAnswer`。
  - `docs/ai-quality-platform-design.md`、`apps/quality-gateway/src/gateway.controller.spec.ts`、`apps/quality-platform-service/src/modules/case/excel.service.spec.ts`、`apps/quality-execution-service/src/execution.service.ts`、`apps/quality-platform-service/src/modules/review/review.service.ts`：移除演示种子数据、示例被测服务和 demo 命名残留，文档明确系统启动只初始化管理员账号，业务应用、用例和计划均来自真实维护或导入。
  - `packages/shared-database/src/seed.ts`、`packages/shared-database/src/constants.ts`、`apps/quality-platform-service/src/modules/case/case.service.ts`：删除 seed 模块中业务应用、分类、用例、计划、运行批次的空种子接口和多模型 seed 操作规划器；系统预置应用编码改为数据库常量，平台用例服务自持业务类型。
  - `apps/quality-platform-service/src/modules/plan/plan.service.ts`：删除执行计划服务里的 `process.env.VITEST` 数据库禁用分支和生产代码内置 Map 存储兜底，改为正式 `PlanDataStore` 注入；测试内存存储仅保留在 spec 内。
  - `apps/quality-platform-service/src/modules/review/review.service.ts`：删除人工复核服务里的 `process.env.VITEST` 数据库禁用分支、Map 存储兜底和数据库不可用时构造复核记录的假写入逻辑，改为正式 `ReviewDataStore` 注入。
  - `apps/quality-platform-service/src/modules/provider/provider.service.ts`：删除模型供应商服务里的 `process.env.VITEST` 数据库禁用分支、provider/model Map 存储兜底、内存模型 ID 和 `saved ?? record` 假持久化逻辑，改为正式 `ProviderDataStore` 注入。
  - `apps/quality-platform-service/src/modules/app/app.service.ts`：删除 AI 应用服务里的 `process.env.VITEST` 数据库禁用分支、应用/评估配置 Map 存储兜底和 `saved ?? record` 假持久化逻辑，改为正式 `AppDataStore` 注入。
	  - `apps/quality-platform-service/src/modules/report/report.service.ts`：删除工作台统计服务里的 `process.env.VITEST` 数据库禁用分支和数据库不可用时返回空统计的假兜底，改为正式 `ReportDataStore` 注入。
	  - `apps/quality-platform-service/src/health.controller.ts`：删除健康检查里的 `process.env.VITEST` 数据库探测跳过分支，测试改为显式注入探针，默认健康检查始终真实探测 MySQL。
	  - `apps/quality-platform-service/src/modules/case/case.service.ts`：删除用例服务数据库层 `process.env.VITEST` 禁用分支、读表异常吞噬、数据库不可用时回退服务内 Map 的假数据路径，以及服务内 `categories/cases/preset/subscriptions` 缓存；分类、用例和预置订阅均从 `CaseDataStore` 读取，测试用内存状态只保留在 spec 注入存储中。
	  - `apps/quality-execution-service/src/execution.service.ts`：删除执行服务里的 `process.env.VITEST` 数据库禁用和启动恢复跳过分支，启动恢复默认由是否使用默认数据库与 worker 开关决定，测试通过显式依赖注入控制。
	  - `apps/quality-execution-service/src/execution.service.ts`：删除 `ExecutionDatabase` 中不可达的 `if (!prisma) return null/undefined` 分支，默认执行数据库层只表达真实 Prisma/MySQL 读写，不再保留数据库客户端为空的旧兜底路径。
	  - `apps/quality-execution-service/src/execution.service.ts`：删除执行服务 `saved ?? run/result/call` 假持久化兜底，执行批次、执行结果和评估调用审计写入返回空值时直接失败；恢复任务遇到缺失结果时会真实补写持久化结果，不再制造仅存在于内存里的占位结果。
		  - `apps/quality-execution-service/src/execution.service.ts`：删除执行服务配置读取的内存缓存和虚拟计划兜底，用例、计划、应用协议、评估配置、裁判模型与供应商均从注入数据源读取；缺失配置直接失败，不再构造 `planName = planCode` 的假计划。
		  - `apps/quality-execution-service/src/execution.service.ts`：删除执行服务把 `runs/results/judgeCalls` 进程内 Map 当作持久化数据源的兜底路径；批次、结果和评估调用审计查询均要求注入数据源返回真实持久化记录，测试改为显式 stateful 存储桩。
		  - `apps/quality-execution-service/src/execution.service.ts`：执行批次数据库读取不再把缺失计数、Token、平均分、状态、阶段或计费状态默认成 `0/COMPLETED/NOT_CALCULATED`；持久化 run 记录字段缺失或枚举非法时直接失败，避免坏批次被展示成正常完成历史。
		  - `apps/quality-execution-service/src/execution.service.ts`：执行服务读取评估配置、裁判模型和裁判供应商时不再把缺失模型 ID、空供应商字段、未知模型类型/协议或缺失启停状态默认成可用配置；坏记录直接失败，避免评估调用以空模型、错误协议或不可用供应商继续发起。
			  - `apps/quality-execution-service/src/execution.service.ts`：执行服务读取持久化用例和计划时不再把缺失应用编码、分类 ID、问题内容、期望回答、用例作用域、计划名称或计划状态默认成空值、APP 用例或启用计划；执行编排层也不再从 `inputJson/expectedJson` 反补问题内容、期望回答或默认启用用例；坏用例/坏计划直接失败，避免错误筛选进入真实执行。
			  - `apps/quality-execution-service/src/execution.service.ts`：执行结果和评估调用审计读取不再把缺失阶段、通过状态、最终回答、最终得分、提示词、调用状态或计费状态默认成 `PENDING/PASS/空值/FAILED/SKIPPED_NO_PRICE`；坏历史记录直接失败，避免错误结果污染详情、统计和计费审计。
			  - `apps/quality-execution-service/src/execution.service.ts`：执行结果持久化不再把缺失的 `caseSnapshotJson/requestJson/appStatus/evaluationStatus` 补成当前用例快照、空对象或 `PENDING`；写入和更新都要求执行链路提交真实结果字段，坏结果直接失败。
			  - `apps/quality-execution-service/src/execution.service.ts`：重新评估和重试从执行结果快照重建用例时不再把缺失分类、问题内容、期望回答或快照 JSON 补成空字符串/空对象；坏快照直接失败，避免用空用例继续调用评估模型或被测应用。
			  - `apps/quality-execution-service/src/execution.service.ts`：裁判模型评分 JSON 不再为缺失 `score`、非法 `passStatus` 或缺失 `reason` 套 0 分/FAIL/默认理由；评估模型必须返回当前评分契约，否则本次评估标记为 `JUDGE_EVALUATION_FAILED`。
		  - `apps/quality-execution-service/src/execution.service.ts`：删除执行数据库层对非数字用例 ID、执行结果 ID 和评估审计外键的假成功处理；真实 Prisma 写入必须使用已持久化数据库 ID，不再直接返回未落库结果或把无效外键写成 `0`。
	  - `apps/quality-execution-service/src/health.controller.ts`、`apps/quality-execution-service/src/execution.service.ts`：执行服务健康检查不再吞掉执行批次读取失败并显示空闲 Worker；读取持久化执行状态失败时返回 `DOWN` 和明确错误消息，gateway 聚合健康随之降级。
	  - `packages/shared-database/prisma/schema.prisma`、`docs/ai-quality-platform-design.md`：删除未读写的 `eval_result.traceId` 废弃字段和应用响应 trace 抽取旧承诺；真实 AI 调用追踪保留在 AI invocation 请求契约与评估调用审计中。
	  - `apps/web/src/features/cases/case-csv.ts`：用例 CSV 下载模板删除内置“敏感问题”示例行，只保留正式表头，避免首次上线向用户模板注入样例业务数据。
	  - `apps/web/src/lib/error.ts`、`apps/web/src/features/apps/app-protocol.tsx`、`apps/web/src/features/apps/case-form-dialog.tsx`、`apps/web/src/source-hygiene.spec.ts`：删除前端 `catch (...: any)` 临时类型逃逸，错误消息和 Abort 判断统一通过 `unknown` 辅助函数收口，并增加源码卫生红线测试。
	  - `apps/quality-platform-service/src/modules/case/case.service.ts`：删除用例服务实体 ID 的时间戳 + `Math.random()` 临时生成方式，改为 `node:crypto` 随机字节生成，并用源码红线测试阻止可预测随机源回流。
	  - `packages/ai-invocation-client/src/index.ts`：AI 调用客户端不再把内部 AI 服务的非法 JSON 或缺少正式状态的 200 响应解包成空对象并强转为成功结果；坏响应统一返回 `AI_INVOCATION_SERVICE_BAD_RESPONSE`。
	  - `apps/quality-platform-service/src/modules/case/case.service.ts`：预置分类订阅写入/删除不再 `catch {}` 吞掉所有数据库异常；只对 Prisma `P2002` 已存在和 `P2025` 已删除两类幂等错误静默处理，其余错误继续抛出。
	  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`：协议测试和执行调用不再把非法请求头/请求体 JSON 模板吞成空对象继续调用；请求模板必须解析为 JSON 对象，否则直接返回明确配置错误，避免坏协议被伪装成调用通过。
	  - `apps/quality-platform-service/src/modules/app/app.service.ts`、`apps/quality-execution-service/src/execution.service.ts`、`apps/quality-execution-service/src/adapter.service.ts`：应用协议测试和执行调用不再把非法响应 JSON 解析成 `{}` 或 `{ rawText }` 继续通过；非流式响应和 SSE data 事件必须是 JSON 对象，旧的未引用 `AdapterService` 流式解析残留已删除。
	  - `apps/quality-execution-service/src/execution.service.ts`：评估模型返回的评分内容不再用 `{}` 兜底成默认 `FAIL/0分` 且标记为评估通过；裁判评分必须是合法 JSON 对象，否则结果进入评估失败并写入明确错误码。
		  - `packages/shared-auth/src/index.ts`、`packages/shared-config/src/index.ts`：认证 token 解码不再把非法 JSON 段兜底成空对象；生产被测应用 allowlist 配置包含非法 URL 时 fail-closed，不再静默忽略坏配置后继续放行公网调用。
		  - `apps/quality-platform-service/src/modules/app/app.service.ts`：自动生成应用编码不再使用 `Date.now().toString(36)` 时间戳后缀，改为 `node:crypto` 随机字节后缀，并增加源码红线测试。
		  - `apps/quality-execution-service/src/execution.service.ts`：执行 Worker 失败时不再把所有根因覆盖成固定“执行任务处理失败”，健康诊断 `lastError` 记录真实异常消息，方便上线后排查计划读取、数据库和执行配置错误。
		  - `apps/quality-execution-service/src/execution.service.ts`：执行 Worker 异常收尾不再二次读取结果并在失败时吞错成空数组；批次失败摘要使用本次任务已持有的真实结果快照，避免费用审计等后续异常把已完成应用/评估计数抹成 0。
		  - `apps/quality-execution-service/src/execution.service.ts`：默认后台 runner 不再用 `catch(() => undefined)` 静默吞掉未处理异常，未捕获后台错误会写入 Worker 健康诊断 `lastError`。

### 2026-05-27 — 开发 Node 与生产 Docker 拓扑收敛

#### 重构 — 生产只暴露 nginx 最终入口，开发保留 Node 调试端口
- **变更需求**：用户明确开发环境使用 Node，本机调试端口可以暴露；生产环境使用 Docker，只暴露最终系统入口，内部服务不映射宿主机端口。
- **变更内容**：
  - `docker-compose.yml`：改为生产拓扑，新增 nginx 入口，默认只映射 `${PUBLIC_WEB_PORT:-5670}:80`，web/gateway/platform/execution/AI invocation/mysql 均不映射宿主机端口。
  - `docker-compose.dev-deps.yml`：新增开发依赖 compose，仅暴露 MySQL，供本机 `pnpm dev:*` 使用。
  - `nginx/default.conf`：新增入口转发规则，页面流量转发到 `web:3000`，API 与聚合健康转发到 `quality-gateway:8080`。
  - `packages/shared-config/src/index.ts`：公共 API URL 支持开发端口 `3000 -> 8080` 与生产 nginx 同源两种模式，支持 `NEXT_PUBLIC_GATEWAY_ORIGIN=same-origin`。
  - `apps/quality-gateway/src/health.controller.ts`：`/ai-quality-platform/health.do` 改为聚合 platform/execution 内部健康结果。
  - `apps/web/src/features/health/*`：健康页只请求一个聚合健康接口，不再展示 gateway 或内部服务完整 URL。
  - `Dockerfile`、各运行单元 `package.json`：Docker 镜像使用生产启动命令，不再使用 `dev`/`watch` 命令。
  - `scripts/check-health.mjs`、`scripts/check-topology.mjs`：同步单聚合健康与生产拓扑校验。
  - `docs/004-本地部署.md`、`docs/20260527-005-生产部署拓扑与开发运行标准.md`：补充开发 Node 与生产 Docker 的运行标准、拓扑图和健康检查边界。

### 2026-05-27 — 服务架构收敛设计

#### 文档 — 规划后端从 8 个业务服务收敛为平台服务与执行服务
- **变更需求**：用户希望重新评估当前服务端服务数量，减少不必要的后端进程，同时保留 gateway、AI 调用标准和异步 worker 的合理边界。
- **变更内容**：
  - `docs/20260527-002-服务架构收敛设计.md`：新增服务架构收敛设计，明确目标拓扑为 `quality-gateway + quality-platform-service + quality-execution-service + quality-ai-invocation-service + ai-model-adapter package`。
  - `docs/20260527-002-服务架构收敛设计.md`：梳理现有 business/case/plan/ai/review/statistics/system/execution 服务归并去向、公开 API 兼容策略、健康检查调整、AI 模型调用标准和分阶段迁移验收清单。
  - `docs/20260527-003-服务架构收敛实施计划.md`：新增实施计划，将服务收敛拆分为共享配置、gateway、platform 服务、健康检查、AI adapter、旧服务删除和浏览器验收等可执行任务。
  - `packages/shared-config/src/index.ts`、`apps/quality-gateway/src/gateway-router.ts`：区分公开 API 段与真实部署服务，business/case/plan/ai/review/statistics/system 统一转发到 platform，execution 继续转发到 execution。
  - `apps/quality-platform-service`：新增平台服务，承载应用、用例、计划、模型配置、人工复核、报表统计和登录模块；删除旧的 business/case/plan/ai/review/statistics/system 独立服务目录。
  - `packages/ai-model-adapter`：新增模型调用标准 package，统一 OpenAI/Qwen 兼容请求体、`enable_thinking: false`、usage 归一和失败结果结构；执行服务复用该 adapter。
  - `package.json`、`scripts/check-health.mjs`、`apps/web/src/features/health/*`：本地启动和健康检查收敛为 gateway/platform/execution/AI invocation 关键运行单元，健康页同步展示新拓扑。
  - `docs/ai-quality-platform-design.md`：更新总体架构、端口规划、服务拆分和 Docker 部署规划，移除旧 8 业务服务拓扑。
  - `docs/ai-quality-platform-design.md`：修正执行链路中的旧 `ai-service`、`statistics-service` 和 Redis 队列表述，改为 execution service 阶段推进、`ai-model-adapter` 模型评估和 platform 统计查询。
  - `docs/20260527-004-服务架构收敛后续优化目标.md`：新增收敛后的持续优化目标，按合并收口、运行健康、执行 Worker、AI 调用标准、Platform 模块治理和部署 CI 六类规划后续推进顺序。
  - `apps/quality-platform-service/src/health.controller.ts`：健康检查返回数据库和模型供应商诊断详情；数据库作为 platform 基础健康硬依赖，模型供应商作为可选诊断项。
  - `apps/quality-execution-service/src/health.controller.ts`、`apps/quality-execution-service/src/execution.service.ts`：执行服务健康检查增加 worker 启用状态、活跃运行数、RUNNING 批次数、恢复状态和最近心跳。
  - `apps/web/src/features/health/service-health.tsx`：健康页增加公开 API 段到运行单元的路由关系，并展示数据库和 worker 诊断摘要。
  - `packages/ai-model-adapter`、`apps/quality-execution-service/src/execution.service.ts`：模型调用标准从请求体/usage 工具扩展为 OpenAI 兼容 ProviderAdapter、稳定供应商错误码和通用 token 费用计算，执行评估阶段改为复用 adapter。
  - `apps/quality-platform-service/src/modules/*/README.md`：补充 platform 内部模块职责边界和依赖规则，避免服务合并后模块边界退化。
  - `docker-compose.yml`、`.env.example`、`.github/workflows/ci.yml`、`scripts/check-topology.mjs`、`docs/004-本地部署.md`：部署和 CI 收敛为 web/gateway/platform/execution/AI invocation/mysql 拓扑，新增拓扑检查脚本并记录 `WATCHPACK_POLLING=true` 本地兜底启动方式。

### 2026-05-27 — 首页应用工作台真实数据与布局重设计

#### 修复与优化 — 工作台从裸文本占位改为平台级质量驾驶舱
- **变更需求**：用户反馈首页应用工作台也存在数据展示和页面设计问题，需要按真实业务重新规划设计。
- **变更内容**：
  - `apps/web/src/features/dashboard/dashboard.tsx`：移除失效的旧样式 class，重构为当前系统统一的卡片、列表和操作入口布局；工作台展示平台统计、最近执行、重点关注应用和快速入口。
  - `apps/web/src/features/dashboard/dashboard.tsx`：除统计服务外，额外读取应用列表、计划列表和执行记录，将最近执行展示为应用名、计划名、第 N 次执行、通过/未达标数量和耗时，避免继续展示技术编码。
  - `apps/web/src/features/dashboard/dashboard.spec.tsx`：补充首页真实统计、计划名映射、最近执行摘要和隐藏计划编码的回归测试。

### 2026-05-27 — 应用概览页真实统计与布局重设计

#### 修复与优化 — 概览页展示真实统计和可读执行记录
- **变更需求**：用户反馈应用概览页测试用例、执行计划等数据没有正确显示，最近执行记录展示技术编码且整体布局需要重新设计。
- **变更内容**：
  - `apps/quality-business-service/src/app.service.ts`：应用详情接口补齐与应用列表一致的聚合统计，保证概览页通过 `detail.do` 获取到真实用例数、计划数和最近通过率。
  - `apps/web/src/features/apps/app-overview.tsx`：概览页重构为应用头部、关键指标、最近执行记录和应用配置四块；最近记录合并计划列表映射，展示计划名称、第 N 次执行、通过/未达标数量和耗时，不再把计划编码作为主信息。
  - `apps/quality-business-service/src/app.service.spec.ts`、`apps/web/src/features/apps/app-overview.spec.tsx`：新增后端详情统计和前端可读执行记录回归测试。

### 2026-05-27 — 根路径自动进入平台文根

#### 优化 — 访问 `/` 自动跳转到 `/ai-quality-platform`
- **变更需求**：用户反馈通过局域网 IP 直接访问 `http://192.168.11.107:3000/` 时还需要手动补文根，希望裸根路径能自动进入平台。
- **变更内容**：
  - `apps/web/src/app/page.tsx`：新增 Next 根路由，服务端直接重定向到共享配置中的平台文根 `/${CONTEXT_PATH}`。

### 2026-05-27 — 局域网访问下网关地址跟随页面 Host

#### 修复 — LAN IP 打开前端时业务数据不再请求访问端本机 localhost
- **变更需求**：用户反馈用 `http://192.168.11.107:3000` 访问前端时模型供应商等业务数据加载不出来，而 `http://127.0.0.1:3000` 正常。
- **变更内容**：
  - `packages/shared-config/src/index.ts`：公共 Gateway URL 在浏览器环境下改为使用当前页面 `location.hostname`，避免局域网访问时仍请求 `127.0.0.1:8080`。
  - `apps/web/next.config.ts`：开发环境自动放行本机局域网 IPv4 作为 `allowedDevOrigins`，避免通过 `192.168.x.x:3000` 打开时 Next 开发客户端资源被拦截，导致页面未正常 hydrate、客户端数据加载不执行。
  - `apps/web/src/features/health/service-health.tsx`、`apps/web/src/features/health/hooks.ts`：健康检查中的 gateway 地址同步使用共享的公共 Gateway URL 生成逻辑。
  - `packages/shared-config/src/config.spec.ts`、`apps/web/src/lib/api/gateway-client.spec.ts`、`apps/web/src/features/health/service-health.spec.tsx`：补充和更新回归测试，覆盖局域网 IP host 生成与 Web 默认 `localhost` host 断言。

### 2026-05-27 — 修复执行详情页分类联动与列表布局

#### 修复 — 状态统计支持分类联动，列表宽度防溢出
- **变更需求**：用户反馈点击左侧分类后，右侧顶部的状态统计卡片（总用例数、达标率等）没有按分类变化，且右侧列表区域内容过长时撑开了父容器导致排版变形。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：统计区数据（`total/passed/failed`）改为基于当前选中分类过滤后的结果（`categoryResults`）进行动态计算，确保顶部统计卡片和 Tab 数字完全与左侧选择联动；同时保证左侧「全部」按钮依然显示大盘总数。
  - `apps/web/src/features/apps/app-history-detail.tsx`：为右侧 Tab 过滤 + 结果列表的 flex 父容器增加 `min-w-0` 类名，截断内部可能过长的不换行元素（如 JSON 或长文本段落），解决 flex 布局下子元素将父级容器宽度撑开溢出的问题。

### 2026-05-27 — 执行详情界面支持分类统计与重试筛选

#### 新增与优化 — 详情页增加左侧分类边栏，重试逻辑精细化
- **变更需求**：用户反馈在任务详情里没有分类，用例多的时候无法了解每个分类的情况，建议使用类似用例管理左侧显示分类的设计；另外，未达标/执行失败的需要增加“重新发起评估”按钮，业务接口调用失败的需要可以重新发起全量重试（调用+评估）。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：重构布局，增加左侧分类统计边栏，计算每个分类下的总用例数与通过率；原有的统计面板保留为总体统计，放在右上区域；卡片操作区重构为 DropdownMenu，包含更精细的「全量重试」与「重新自动评估」操作。
  - `apps/quality-execution-service/src/execution.service.ts`、`apps/quality-execution-service/src/execution.controller.ts`：后端执行服务增加分类映射支持；新增 `/execution/re-evaluate.do` 接口方法 `reEvaluate`，实现绕过业务接口调用的纯 LLM 重新评估逻辑，只更新相关记录的 evaluationStatus 和评估数据。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`：前端 API 层增加 `reEvaluateResults` 调用封装，并在 `ResultRecord` 类型中增加 `categoryId`。



#### 修复 — 执行计划启动只保留一条成功提示
- **变更需求**：用户反馈执行计划启动后页面连续弹出两条成功消息，分别提示“已触发”和“执行批次已创建”，造成重复干扰。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`：移除点击确认后的即时成功 toast，保留服务端返回后的“执行批次已创建 / 执行完成”结果提示；执行中状态继续由按钮禁用和计划卡片进度区即时反馈。
  - `apps/web/src/features/apps/app-plans.spec.tsx`：新增回归测试，验证启动 RUNNING 执行批次时只弹出一条成功提示。

### 2026-05-27 — 评估调用关闭思考模式

#### 修复 — Qwen 评估请求显式禁用 thinking
- **变更需求**：用户反馈结果评估阶段不需要开启 thinking，评估模型调用应显式关闭，避免产生无意义的思考过程和额外 token 消耗。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：百炼/Qwen 兼容评估请求体增加 `enable_thinking: false`，普通 OpenAI 兼容请求不额外写入该非标准字段。
  - `apps/quality-execution-service/src/execution.service.spec.ts`：新增回归测试，验证评估请求和持久化的 judge call 审计请求都包含 `enable_thinking: false`。

### 2026-05-27 — 通用系统预置与信用网站应用用例 CSV 规划

#### 文档 — 区分通用系统预置与信用网站应用自有用例
- **变更需求**：用户希望先审核用例规划，再生成存放于 `docs/` 的 CSV 文件；系统预置用例必须与具体业务无关，可被所有 AI 应用复用，信用业务类用例应作为当前应用自有用例。
- **变更内容**：
  - `docs/20260527-001-信用网站预置用例CSV规划.md`：新增规划文档，定义约 80 条通用系统预置用例的 6 个大方向分类清单，覆盖敏感词问题、安全渗透、胡乱咨询、涉密涉黄与违规、隐私与权限越界、诱导编造与虚假承诺；同时定义当前信用网站应用引用全部通用预置分类，并额外导入 62 条“信用中国（北京）”应用自有用例。
  - `docs/20260527-通用系统预置用例.csv`：新增 80 条通用系统预置用例，使用 `问题分类 / 问题内容 / 期望回答` 三列表头和 UTF-8 BOM 编码。
  - `docs/20260527-信用中国北京应用用例.csv`：新增 62 条信用中国北京应用自有用例，覆盖站点身份、动态资讯、政策法规、公共报告、专项报告、信用修复、异议申诉、信用查询、政务诚信投诉和信用专题。

### 2026-05-27 — 用例 CSV 导入导出

#### 新增 — 预置用例与应用用例支持批量导入导出
- **变更需求**：预置用例和应用用例管理都需要支持下载导入模板、CSV 批量导入和导出，方便用户线下维护 `问题分类 / 问题内容 / 期望回答` 三列后快速批量添加用例。
- **变更内容**：
  - `apps/quality-case-service/src/case.service.ts`、`apps/quality-case-service/src/case.controller.ts`：新增 `/case/import-csv.do`，按中文最小字段导入；分类按名称自动匹配或创建，同作用域同分类同问题执行更新，否则新增。
  - `apps/web/src/features/cases/case-csv.ts`：新增 CSV 解析、生成、模板与下载工具，支持中文表头、引号、逗号、换行和空行处理。
  - `apps/web/src/features/cases/index.tsx`：系统预置用例页增加“下载模板 / 导入 CSV / 导出 CSV”，导入写入系统预置库。
  - `apps/web/src/features/apps/app-cases.tsx`：应用用例页增加“下载模板 / 导入 CSV / 导出 CSV”，导入写入当前应用自有用例，并保持顶部按钮响应式换行。
  - `apps/web/src/features/cases/case-csv.ts`、`apps/web/src/features/apps/app-cases.tsx`：导出文件名追加 `yyyyMMddHHmmss` 下载时间；应用用例导出额外带当前应用名称，无法解析应用名称时回退应用编码。
  - `apps/quality-case-service/src/case.service.spec.ts`、`apps/web/src/features/cases/case-csv.spec.ts`、`apps/web/src/features/cases/api/case-api.spec.ts`、`apps/web/src/features/cases/index.spec.tsx`、`apps/web/src/features/apps/app-cases.spec.tsx`：补充 CSV 导入、导出工具、API 封装和两处页面入口的回归测试。

### 2026-05-27 — 执行详情紧凑展示与响应式优化

#### 优化 — 收敛全通过、计费、长文本与耗时展示
- **变更需求**：用户反馈执行详情页全量通过时不应再提供全量重试，已通过结果不应出现重复的“标为评估通过”动作，计费状态、实际回答、评估结论、耗时和多尺寸布局都需要更符合真实验收场景。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：全量通过时隐藏“全量重试”；人工修订菜单按当前结果状态只展示有效动作，已通过结果仅允许改为未达标或恢复 AI 评估。
  - `apps/web/src/features/apps/app-history-detail.tsx`：费用已计算时隐藏冗余计费状态，未计费/部分计费/未配置价格直接作为状态文案；总费用继续保留最多 2 位小数。
  - `apps/web/src/features/apps/app-history-detail.tsx`：非已计费状态下合并费用金额与计费状态，费用块直接显示“未计费 / 部分计费 / 未配置价格”，不再额外展示“费用 -”加状态块。
  - `apps/web/src/features/apps/app-history-detail.tsx`：列表里的实际回答和评估结论改为单行截断，并支持悬浮查看完整内容；单条耗时与整次执行总耗时改为秒、分钟、小时等可读格式。
  - `apps/web/src/features/apps/app-history-detail.tsx`：执行详情摘要区、统计区、列表行和操作区增加响应式布局；token/费用摘要改为自适应列宽，避免中小屏下费用卡片过早换行。
  - `apps/web/src/features/apps/app-history-detail.spec.tsx`：补充全量通过按钮显隐、人工修订动作过滤、计费状态、单行截断浮层、耗时格式化、费用摘要自适应网格和响应式布局的回归测试。

### 2026-05-27 — 执行详情语义与历史快照修复落地

#### 修复 — 执行详情筛选、人工修订和历史快照一致性
- **变更需求**：按 `docs/20260526-005-执行详情语义与历史快照修复计划.md` 推进实现，修复执行详情页结果语义、未计费展示、人工修订入口、亮色层次和历史数据随用例变更漂移的问题。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：移除“待复核”筛选，统一区分“评估通过 / 未达标 / 执行失败”；列表行内增加人工修订入口并支持恢复 AI 评估；未计费时不再显示“未计算”；亮色模式摘要与列表补充层次背景。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`、`apps/quality-review-service/src/review.service.ts`：人工修订 API 支持 `manualResult: null`，用于清除人工修订并回到 AI 原始评估。
  - `apps/quality-execution-service/src/execution.service.ts`：执行结果详情优先读取 `caseSnapshotJson` 和执行时请求快照，不再用当前用例数据补问题内容和期望回答，保证历史日志固化。
  - `apps/web/src/features/apps/app-history-detail.spec.tsx`、`apps/quality-review-service/src/review.service.spec.ts`、`apps/quality-execution-service/src/execution.service.spec.ts`：补充未计费展示、列表行内修订、恢复 AI 评估和历史快照固化的回归测试。

### 2026-05-26 — 执行详情语义与历史快照修复计划

#### 文档 — 梳理详情页结果语义、人工修订与历史快照固化
- **变更需求**：用户反馈执行详情页未达标图标、待复核分类、人工修订入口、未计费展示、亮色模式层次和历史用例快照存在设计与数据一致性问题，需要先形成可审核实施计划。
- **变更内容**：
  - `docs/20260526-005-执行详情语义与历史快照修复计划.md`：新增实施计划，覆盖前端筛选语义、列表行内人工修订、计费摘要显示、亮暗模式样式、后端 `caseSnapshotJson` 固化读取、人工修订 API 和验收标准。

### 2026-05-26 — 执行详情结果语义与审计布局优化

#### 优化 — 区分评估未达标、执行失败与人工修订
- **变更需求**：用户反馈执行详情页统计卡片过多、结果状态“失败”语义不准、明细抽屉的问题/期望展示占位过大，且接口调用与评估调用 JSON 不应默认铺满页面。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：统计区收敛为一个紧凑摘要面板；筛选项调整为“评估通过 / 未达标 / 执行失败 / 待复核”；列表和抽屉统一把“评分依据”改为“评估结论”，并用图标标识结论状态。
  - `apps/web/src/features/apps/app-history-detail.tsx`：明细抽屉内问题内容与期望回答改为两行紧凑展示，评估调用状态改为中文业务文案，接口调用和评估调用默认折叠，JSON 区域限制高度并在区域内滚动。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`、`apps/web/src/features/apps/app-history-detail.tsx`：复用 `start.do` 支持全量重试和执行失败单条重试；接入 `review/submit.do` 支持人工修订结果并显示“人工修订”标识。
  - `apps/quality-execution-service/src/execution.service.ts`：执行结果列表读取 `eval_review` 最新人工复核记录，返回 `manualResult`、`reviewStatus` 和 `reviewComment`，保证人工修订标识可持久化。
  - `apps/web/src/features/apps/app-history-detail.spec.tsx`：补充结果语义、人工修订和单条重试的回归测试。

### 2026-05-26 — 执行详情费用展示与明细抽屉优化

#### 修复 — 重算费用后保留任务名称和执行版本
- **变更需求**：用户反馈执行详情页点击重新计费后标题退化为计划 ID，执行版本也没有选中；总费用展示精度过高；结果明细弹窗希望改成侧边栏并优化展示。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：`cost/recalculate.do` 返回值补齐可读任务名称和执行序号，并保留原完成时间，避免重算费用污染执行记录上下文。
  - `apps/web/src/features/apps/app-history-detail.tsx`：费用展示改为最多 2 位小数；重新计算费用后保留已有 `planName` 和 `sequenceNo`；结果明细从居中弹窗改为右侧抽屉式详情面板。
  - `apps/quality-execution-service/src/execution.service.spec.ts`、`apps/web/src/features/apps/app-history-detail.spec.tsx`：补充费用重算上下文保留、费用展示精度和侧边抽屉的回归测试。

### 2026-05-26 — 执行评估两阶段与计费审计落地

#### 新增 — 执行计划拆分接口执行、评估执行与费用汇总
- **变更需求**：按设计文档推进执行计划真实化，记录评估模型调用输入输出、usage、token 与费用，支持应用接口并发和评估并发分开配置。
- **变更内容**：
  - `packages/shared-database/prisma/schema.prisma`：扩展 `EvalRun`、`EvalResult`，新增 `EvalJudgeCall` 审计表，并为应用评估配置增加 `evaluationConcurrency`。
  - `apps/quality-execution-service/src/execution.service.ts`：执行批次改为 `APP_CALLING -> EVALUATING -> COSTING` 三阶段持久化推进，启动时立即创建结果占位记录，支持服务重启恢复、分阶段并发、评估调用审计和费用重算。
  - `apps/quality-execution-service/src/judge-usage.ts`、`apps/quality-execution-service/src/judge-cost.ts`：新增 usage 归一化和三档价格计费逻辑，支持 Qwen cached token。
  - `apps/quality-business-service/src/app.service.ts`、`apps/quality-ai-service/src/provider.service.ts`：接口配置增加应用接口并发数，评估配置增加评估并发数，模型中心支持普通输入、缓存命中输入和输出价格。
  - `apps/web/src/features/apps`、`apps/web/src/features/models`：协议页、评估配置页、模型中心、执行计划页和执行详情页同步展示并发配置、模型价格、分阶段进度、token/费用摘要、评估调用审计和重新计算费用入口。

### 2026-05-26 — 执行评估两阶段与计费审计计划

#### 文档 — 覆盖前端、后端与 DB 的实施计划
- **变更需求**：用户提出执行计划需要拆分为接口执行与评估执行两个独立阶段，完整记录评估模型调用输入输出，并按模型中心配置的普通输入、缓存命中输入、输出价格计算 token 用量和费用。
- **变更内容**：
  - `docs/20260526-004-执行评估两阶段与计费审计计划.md`：新增正式实施计划，覆盖 DB schema、后端执行服务、业务配置服务、模型中心服务、前端配置页、执行计划/历史详情页面、API 契约、usage 归一化、费用计算、兼容迁移和验收标准。

### 2026-05-26 — 执行详情版本切换器

#### 新增 — 详情页可切换同计划执行版本
- **变更需求**：用户反馈执行详情标题中不应直接把“第 N 次”放在标题里；当前 URL 对应的第几次执行应作为标题描述样式展示，并支持下拉切换该任务下所有执行版本，选择后 URL 和页面数据同步切换。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`、`apps/quality-execution-service/src/execution.controller.ts`：新增 `/execution/run-versions.do` 轻量接口，根据当前 `runCode` 返回同一应用同一计划下所有执行版本的 `runCode`、`sequenceNo`、用例数量、均分、状态与时间字段。
  - `apps/web/src/features/apps/app-history-detail.tsx`：详情页标题只展示任务名称；标题下方增加可点击的执行版本下拉按钮，展示“第 N 次”，下拉项展示“第 N 次 + 用例数量 + 均分”，选择其他版本后跳转到对应执行记录 URL。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`：新增 `RunVersionRecord` 类型和 `listRunVersions` API 封装。
  - `apps/quality-execution-service/src/execution.controller.spec.ts`、`apps/web/src/features/apps/app-history-detail.spec.tsx`：补充执行版本轻量接口、标题展示和版本切换 URL 的回归测试。

### 2026-05-26 — 执行计划展示序号与结果语义优化

#### 优化 — 计划卡片隐藏技术 ID，执行记录展示第 N 次
- **变更需求**：用户反馈计划卡片标题下方不需要展示计划 ID 和重复的执行次数；结果未达预期不应使用“任务出错”意味很强的打叉图标；每次执行应有序列号，详情页标题也应展示第几次执行。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：为执行记录动态计算同一应用同一计划下的 `sequenceNo`，`start.do`、`run-list.do`、`run-detail.do` 都返回可读执行序号。
  - `apps/web/src/features/apps/app-plans.tsx`：计划卡片移除标题下方的 `planCode` 和重复“共执行 N 次”；最近执行、运行中状态和展开历史改为展示“第 N 次”；未达预期数量改用告警图标与“未达标”文案。
  - `apps/web/src/features/apps/plan-history-sheet.tsx`、`apps/web/src/features/apps/app-history-detail.tsx`：侧边历史和详情标题同步展示执行序号，详情结果的失败态文案调整为“未达标”。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`、`apps/web/src/features/apps/types.ts`：补充 `sequenceNo` 类型字段。
  - `apps/quality-execution-service/src/execution.service.spec.ts`、`apps/web/src/features/apps/app-plans.spec.tsx`、`apps/web/src/features/apps/app-history-detail.spec.tsx`：补充执行序号、隐藏技术 ID、未达标文案和详情标题序号的回归测试。

### 2026-05-26 — 计划与执行批次 ID 随机化

#### 修复 — 新建计划和执行批次不再使用可猜测时间戳编码
- **变更需求**：用户反馈任务 ID 和任务执行 ID 是前端/后端拼接出来的可猜测字符串，尤其执行 ID 直接暴露时间戳，应该类似应用 ID 一样不可预测。
- **变更内容**：
  - `apps/quality-plan-service/src/plan.service.ts`：新建计划在未显式传入 `planCode` 时由后端生成 `plan-xxxxxxxxxx` 形式随机编码，并做碰撞检查；调用方仍可在创建时显式指定计划编码。
  - `apps/quality-execution-service/src/execution.service.ts`：启动执行时由后端生成 `run-xxxxxxxxxx` 形式随机执行批次编码，不再拼接 `planCode` 和 `Date.now()`。
  - `apps/web/src/features/apps/app-plans.tsx`、`apps/web/src/features/apps/api/plan-execution-api.ts`：前端创建计划不再自行生成或提交 `planCode`，改由后端返回。
  - `apps/web/src/features/apps/use-plan-runs.ts`、`apps/web/src/features/apps/app-history.tsx`、`apps/web/src/features/apps/app-history-detail.tsx`：执行记录排序与时间展示改用后端真实 `startAt/endAt`，详情页兜底标题不再暴露原始执行 ID。
  - `apps/quality-plan-service/src/plan.service.spec.ts`、`apps/quality-execution-service/src/execution.service.spec.ts`、`apps/web/src/features/apps/app-plans.spec.tsx`：新增不可猜测 plan/run 编码与前端不提交计划编码的回归测试。

### 2026-05-26 — 执行记录详情路由修复

#### 修复 — 执行记录详情使用真实 URL 并展示可读任务名称
- **变更需求**：用户反馈从执行计划点击执行记录进入详情时 URL 不变化，刷新后会回到执行计划页；详情页头部显示任务 ID 不可读，应展示任务名称。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`、`apps/web/src/features/apps/app-history.tsx`：点击执行记录改为跳转到带 `runCode` 的详情路由，不再依赖组件内 `selectedRunCode` 状态。
  - `apps/web/src/app/ai-quality-platform/apps/[appCode]/plans/runs/[runCode]/page.tsx`、`apps/web/src/app/ai-quality-platform/apps/[appCode]/history/[runCode]/page.tsx`：新增可刷新、可直达的执行记录详情页路由。
  - `apps/web/src/features/apps/app-history-detail.tsx`：详情页加载执行批次信息，标题展示计划/任务名称，头部不再显示原始执行 ID。
  - `apps/quality-execution-service/src/execution.controller.ts`、`apps/quality-execution-service/src/execution.service.ts`：新增 `/execution/run-detail.do`，返回执行批次及可读 `planName`。
  - `apps/web/src/features/apps/app-plans.spec.tsx`、`apps/web/src/features/apps/app-history-detail.spec.tsx`、`apps/quality-execution-service/src/execution.controller.spec.ts`：补充 URL 跳转、详情标题和后端 run detail 回归测试。

### 2026-05-26 — 执行计划卡片交互修复

#### 修复 — 去掉计划启停状态、补编辑入口并增强刷新反馈
- **变更需求**：用户反馈执行计划页不需要展示计划启停状态，缺少编辑按钮；右上角刷新按钮点击后没有反馈；运行中时顶部状态与右侧操作和下方进度状态重复。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`：计划卡片移除“启用/禁用”状态 Badge，非运行态新增编辑按钮；运行中隐藏右侧执行/编辑/删除操作，只保留下方进度区状态；刷新按钮增加 loading 与成功/失败 toast 反馈。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`：补充 `updatePlan` 前端 API 封装，对接后端 `/plan/update.do`。
  - `apps/web/src/features/apps/use-plan-runs.ts`：刷新执行记录时保留本地仍在运行且服务端列表暂未返回的批次，避免触发执行后的 RUNNING 状态被旧列表覆盖。
  - `apps/web/src/features/apps/app-plans.spec.tsx`：补充不展示启停状态、编辑计划、刷新反馈、运行态隐藏重复操作的回归测试。

### 2026-05-26 — 全局提醒位置修复

#### 修复 — Toast 默认顶部居中且不遮挡右上角业务按钮
- **变更需求**：用户反馈右上角全局消息弹窗自动关闭前会盖住页面右上角业务按钮；调整为顶部居中后，不再需要显示关闭按钮，且提示尺寸应按内容真实自适应，不应被固定最小宽度撑大。
- **变更内容**：
  - `apps/web/src/components/ui/sonner.tsx`：全局 Toaster 默认展示位置调整为顶部居中，保持无关闭按钮；宽度改为 `max-content` 内容自适应，仅设置最大宽度兜底，提示内边距压缩为 `10px 12px`，并统一默认展示时长为 3.5 秒。
  - `apps/web/src/app/layout.tsx`：根布局不再强制把 Toaster 放在右上角，改为使用全局 Toaster 的非遮挡默认配置。
  - `apps/web/src/components/ui/sonner.spec.tsx`：新增回归测试，保证全局提醒默认顶部居中、不占用右上角操作区且尺寸更轻量。

### 2026-05-26 — 执行计划分类范围修复

#### 修复 — 按分类执行只展示当前应用可用分类
- **变更需求**：用户反馈应用只引入了“敏感问题”分类，但创建执行计划手动选择分类时仍显示未引入的全局分类“22”。
- **变更内容**：
  - `apps/web/src/features/apps/use-plan-runs.ts`：计划页分类加载改为应用自建分类（`includeGlobal: false`）与已订阅预置分类（`subscribedByApp`）合并，不再使用默认包含全部全局分类的查询。
  - `apps/web/src/features/apps/app-plans.spec.tsx`、`apps/web/vitest.setup.ts`：补充按分类执行的分类范围回归测试，并补齐 Radix Select 在 jsdom 下所需的滚动方法模拟。

### 2026-05-26 — 执行计划类型概念移除

#### 删除 — 全局移除计划类型字段与页面入口
- **变更需求**：用户反馈新建执行计划弹窗不需要“计划类型”，要求整个系统全局删除该概念，包括数据库字段。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`、`apps/web/src/features/apps/api/plan-execution-api.ts`：移除计划类型 Badge、弹窗下拉框和创建计划 payload 中的 `planType`。
  - `apps/quality-plan-service/src/plan.service.ts`：删除 `PlanRecord`、`CreatePlanRequest`、数据库 payload 和 row mapper 中的 `planType`。
  - `packages/shared-database/prisma/schema.prisma`、`packages/shared-database/src/seed.ts`：删除 `eval_plan.planType` 字段和种子类型中的计划类型属性。
  - `docs/ai-quality-platform-design.md`：同步删除计划类型设计说明和表字段说明。
  - `apps/web/src/features/apps/app-plans.spec.tsx`、`apps/quality-plan-service/src/plan.service.spec.ts`、`apps/quality-plan-service/src/plan.controller.spec.ts`：补充/更新无计划类型创建和页面不展示计划类型的回归测试。
  - 已执行 `prisma db push --accept-data-loss` 并重新生成 Prisma Client，本地 `eval_plan` 表已删除 `planType` 列。

### 2026-05-26 — AI 应用新建失败修复

#### 修复 — 新建应用支持简化表单并显示具体失败原因
- **变更需求**：用户反馈 AI 应用列表中新建应用失败，toast 只显示“操作失败”，没有具体失败原因。
- **变更内容**：
  - `apps/quality-business-service/src/app.service.ts`：创建应用支持当前表单的最小 payload，仅要求应用名称；未填写应用编码时自动生成隐藏 `appCode`，未配置业务域和接口地址时使用默认值，避免旧字段必填导致 500。
  - `apps/quality-business-service/src/app.service.ts`：创建参数校验改为抛出 `BadRequestException`，例如应用名称为空时返回“请填写应用名称”，不再被包装成无意义的 Internal server error。
  - `apps/web/src/features/apps/app-list.tsx`：应用创建、删除、状态切换失败时优先展示后端返回的错误信息，而不是统一吞成“操作失败”。
  - `apps/quality-business-service/src/app.service.spec.ts`、`apps/web/src/features/apps/app-list.spec.tsx`：补充简化表单创建和具体错误 toast 的回归测试。

### 2026-05-26 — AI 应用内置随机图标

#### 新增 — 应用创建生成内置图标配置，列表与概览统一渲染
- **变更需求**：用户希望 AI 应用卡片不再固定显示同一个机器人图标，新建应用时从内置图标库中生成类似风格但有区分度的图标。
- **变更内容**：
  - `apps/quality-business-service/src/app-icon.ts`：新增后端图标预设工具，内置 16 个图标、12 个主题、4 个变体，共 768 种组合；新建应用时随机生成配置，老数据按应用编码和名称稳定兜底。
  - `apps/quality-business-service/src/app.service.ts`：应用图标配置写入既有 `adapterConfig.ui.icon`，避免新增数据库字段；编辑应用、保存接口协议时保留原图标配置。
  - `apps/web/src/features/apps/app-icon-config.ts`、`apps/web/src/features/apps/app-icon.tsx`：新增前端图标解析和渲染组件，应用列表与应用概览页共用同一套视觉表现。
  - `apps/web/src/features/apps/api/app-api.ts`：映射后端 `adapterConfig.ui.icon` 到前端 `App.icon`。
  - `apps/quality-business-service/src/app.service.spec.ts`、`apps/web/src/features/apps/api/app-api.spec.ts`、`apps/web/src/features/apps/app-list.spec.tsx`：补充图标生成、持久化保留、接口映射和列表渲染回归测试。

### 2026-05-26 — 执行计划真实运行态与进度修复

#### 修复 — 执行批次先落库、逐条更新进度与时间
- **变更需求**：用户反馈执行计划页在执行中时进度一开始就是满的，执行记录次数不会立即增加，执行时间也不准确。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：`start.do` 改为先创建 `RUNNING` 执行批次并立即返回，后台逐条执行用例、落 `eval_result`，每完成一条就更新 `eval_run` 的通过/失败/待审计数和均分，最终切换为 `COMPLETED`。
  - `apps/quality-execution-service/src/execution.service.ts`：后台执行改为持久化 job worker 模式，`eval_run.status=RUNNING` 作为可恢复队列；服务启动时扫描并续跑未完成批次，已落库的 `eval_result` 会被跳过，避免重启后重复执行。
  - `apps/quality-execution-service/src/execution.service.ts`：修正 `eval_run.startedAt/finishedAt` 写入逻辑，运行中不再提前写结束时间，列表返回 `startAt/endAt/durationMs` 供前端展示真实执行时间。
  - `apps/web/src/features/apps/use-plan-runs.ts`、`apps/web/src/features/apps/app-plans.tsx`：计划页将 `start.do` 返回的服务端运行批次立即合并进列表，让执行次数即时增加；执行中只使用服务端 `RUNNING` 批次计算进度，避免把上一条完成记录误当作当前进度。
  - `apps/quality-execution-service/src/execution.service.spec.ts`、`apps/web/src/features/apps/app-plans.spec.tsx`：补充执行批次立即创建、逐条更新进度、worker 重启恢复、前端执行次数即时增加和进度从已完成用例数计算的回归测试。

### 2026-05-26 — 执行计划页面全面升级

#### 新增 — 计划状态三态显示、执行历史内嵌展开、侧边栏查看更多
- **变更需求**：执行计划页功能升级：增加计划状态感知（从未执行/执行中/已完成）、执行中轮询、最近一次结果可点击、计划卡片展开历史、侧边栏查看完整历史、内嵌详情页；移除独立「执行历史」Tab。
- **变更内容**：
  - `apps/web/src/components/ui/sheet.tsx`：新增 Sheet 侧边抽屉 UI 组件（基于 @radix-ui/react-dialog）。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`：扩展 `RunRecord` 类型（新增 `startAt`/`endAt`/`durationMs`/`planName` 字段）；新增执行状态查询和耗时格式化工具函数。
  - `apps/web/src/features/apps/use-plan-runs.ts`：新建数据 Hook，统一管理计划列表和执行记录；自动检测 RUNNING 状态开启 5s 轮询；按 planCode 归组 runs 数据。
  - `apps/web/src/features/apps/plan-history-sheet.tsx`：新建侧边栏历史组件，展示某计划完整执行记录，支持状态颜色区分、通过率显示、点击进入详情。
  - `apps/web/src/features/apps/app-plans.tsx`：全面重构，计划卡片支持三态（从未执行灰色占位 / 执行中蓝色进度条+轮询 / 已完成绿色摘要）；最近一次结果区改为可点击 button，hover 显示「点击查看详情」提示；卡片底部可展开显示最近 3 次历史记录行，超过 3 次显示「查看更多」入口打开侧边栏；所有历史记录均可点击跳转内嵌详情页（复用 `AppHistoryDetail`）；新增刷新按钮。
  - `apps/web/src/components/app-shell.tsx`：移除侧边导航中「执行历史」Tab 条目（`history` key 和 `Activity` 图标）。

### 2026-05-26 — 预置用例关联模式改造

#### 优化 — 预置分类由"物理复制"改为"动态关联"
- **变更需求**：用户反馈当前预置分类导入应用是复制用例记录，导致系统预置库更新后，应用内已导入的用例无法同步更新；建议改为关联分类的方式动态查询。
- **变更内容**：
  - `packages/shared-database/prisma/schema.prisma`：新增 `AppPresetCategory` 表记录应用订阅的系统预置分类。
  - `apps/quality-case-service/src/case.service.ts`：后端重构，用内存 `Map` 缓存订阅关系；分类和用例列表查询（`listCategories`、`list`）动态合并订阅的预置分类和用例；废弃 `importPresetCasesToApp` 复制逻辑。
  - `apps/quality-case-service/src/case.controller.ts`：提供 `/case/preset/subscribe.do` 等接口管理订阅关系。
  - `apps/web/src/features/apps/app-cases.tsx`：前端「从预置引用」弹窗改为「管理预置分类」模式，展示已关联状态并支持勾选/取消关联；列表查询时单独拉取订阅的预置分类并合并展示；预置用例卡片增加“预置”标识且禁用编辑/删除操作。

### 2026-05-26 — AI 应用列表/编辑弹窗/概览页多项 Bug 修复

#### 修复 — 应用列表卡片统计数据始终为 0/-
- **变更需求**：用户反馈应用列表卡片上用例数、计划数、通过率没有正确显示。
- **变更内容**：
  - `apps/web/src/features/apps/api/app-api.ts`：`mapApp` 函数之前未映射 `stats` 字段，导致所有 App 对象的 `stats` 始终为 `undefined`。现在从后端返回的 `stats` 对象读取用例数、计划数、最近执行时间和最近通过率。
  - `apps/web/src/features/apps/api/app-api.ts`：应用列表读取后端顶层协议字段 `requestMethod/invokeUrl/adapterConfig`，避免真实接口地址被误显示为“未配置接口”。
  - `apps/quality-business-service/src/app.service.ts`：`/app/list.do` 返回每个应用的真实用例数、计划数、最近执行时间和最近通过率；用例数同步计入应用自建用例和已关联的系统预置用例。
  - `apps/quality-business-service/src/app.service.spec.ts`、`apps/web/src/features/apps/api/app-api.spec.ts`：补充应用列表协议字段和统计字段映射的回归测试。

#### 优化 — 应用列表卡片展示负责人
- **变更需求**：用户要求 AI 应用列表卡片展示负责人信息，并放在合适位置。
- **变更内容**：
  - `apps/web/src/features/apps/app-list.tsx`：在应用状态和类型标签后方以同样的 Badge 样式展示负责人姓名，避免单独占用一行。
  - `apps/web/src/features/apps/app-list.spec.tsx`：补充应用卡片负责人展示的回归测试。

#### 修复 — 编辑应用弹窗应用类型不回显、含无效接口配置 Tab、保存按钮不可点击
- **变更需求**：编辑应用时应用类型下拉显示为空；弹窗内含无用的接口配置 Tab（接口配置应在应用详情页单独管理）；保存按钮因 URL 必填校验始终处于禁用状态。
- **变更内容**：
  - `apps/web/src/features/apps/app-form-dialog.tsx`：全量重写，去掉接口配置 Tab 及相关字段；应用类型固定为当前已实现的 `CHAT`；保存按钮 disabled 条件仅保留 `!appName.trim()`，不再要求 url 非空。

#### 修复 — 应用内侧边栏"当前应用"显示 appCode 而非应用名
- **变更需求**：进入应用后，侧边栏「当前应用」显示的是 URL 中的 appCode（如"c"），而非应用名称（如"北京信用小京灵"）。
- **变更内容**：
  - `apps/web/src/components/app-shell.tsx`：新增 `appName` 状态，进入应用路由时异步调用 `loadApp(appCode)` 获取应用名称并展示；加载完成前降级显示 appCode。

#### 修复 — 应用概览页执行历史数据不加载
- **变更需求**：应用概览页的「历史执行」统计卡片始终显示 0，「最近执行记录」始终显示"暂无执行记录"。
- **变更内容**：
  - `apps/web/src/features/apps/app-overview.tsx`：新增 `listRuns(appCode)` 调用，与 `loadApp` 并行加载数据；使用 `RunRecord` 类型正确计算通过率并展示执行记录列表。

---

### 2026-05-26 — 评估模型调用超时诊断与稳定性修复

#### 修复 — 裁判模型请求不再沿用应用接口 30 秒硬超时
- **变更需求**：用户反馈执行历史中多条结果反复出现「评估模型调用失败：This operation was aborted」，需要说明原因并修复每次执行评估失败的问题。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：将应用接口调用超时和评估模型调用超时拆分，评估模型默认等待 180 秒，并根据实际回答长度动态放宽到最多 600 秒；支持通过模型参数 `judgeTimeoutMs`/`timeoutMs` 在安全范围内调整。
  - `apps/quality-execution-service/src/execution.service.ts`：收敛裁判模型默认输出长度，减少评估 JSON 生成耗时；AbortError 不再透出底层英文异常，改为写入明确的「评估模型调用超时」原因。
  - `apps/quality-execution-service/src/execution.service.spec.ts`：补充评估模型被 abort 时仅标记当前结果失败，并显示清晰超时原因的回归测试。

### 2026-05-26 — 执行计划触发反馈与最近结果展示

#### 优化 — 计划卡片展示执行状态并提供即时反馈
- **变更需求**：用户反馈执行计划点击「立即执行」并确认后页面没有反馈，不确定是否真的执行；计划卡片应展示执行中、最近一次执行结果、从未执行过等状态。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`：计划页加载计划时同步读取执行历史，按计划展示最近一次执行状态、通过数、失败数、待审数和平均分。
  - `apps/web/src/features/apps/app-plans.tsx`：点击确认执行后立即将当前计划标记为执行中，禁用按钮并显示加载态；执行完成后自动刷新最近一次结果。
  - `apps/web/src/features/apps/app-plans.spec.tsx`：补充回归测试，覆盖从未执行过、最近执行结果和确认执行后的即时执行中反馈。

### 2026-05-26 — 执行历史详情用例展示调整

#### 优化 — 结果列表直接展示问题、期望回答和实际回答
- **变更需求**：用户反馈执行历史详情的用例结果列表不应再显示用例标题，应直接展示问题内容，并在下方展示期望回答和实际回答。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：结果列表移除用例标题展示，主信息改为问题内容；列表下方新增实际回答展示，保留期望回答和评分依据。
  - `apps/web/src/features/apps/app-history-detail.tsx`：查看明细弹窗标题同步改为问题内容，避免再次显示兼容标题字段。
  - `apps/web/src/features/apps/app-history-detail.spec.tsx`：补充回归断言，确保列表不显示旧标题，并直接展示实际回答。

### 2026-05-26 — 接口测试变量渲染修复

#### 修复 — 协议页发送测试支持 `{{case.input.query}}`
- **变更需求**：用户反馈在平台接口配置页触发测试时，真实 AI 平台收到的问题是 `{{case.input.query}}`，说明测试请求未替换变量。
- **变更内容**：
  - `apps/web/src/features/apps/protocol-template.ts`：新增协议测试模板渲染工具，统一提供 `query`、`case.query`、`case.input.query` 三种测试上下文。
  - `apps/web/src/features/apps/app-protocol.tsx`：接口测试发送前对请求头和请求体模板统一渲染，避免 `{{case.input.query}}` 被原样发送到真实 AI 平台。
  - `apps/web/src/features/apps/app-protocol.spec.tsx`、`apps/web/src/features/apps/protocol-template.spec.ts`：补充回归测试，确认协议测试请求体会把 `{{case.input.query}}` 转换为真实测试输入。

### 2026-05-26 — 应用评估配置与真实裁判模型

#### 新增与修复 — 执行计划接入应用级评估模型和裁判提示词
- **变更需求**：用户要求应用内新增评估配置菜单，可选择评估模型并配置用于逐条用例结果评估的提示词；默认使用系统预置提示词，允许按应用覆盖。若启动前未配置或模型不可用，执行计划不可触发；若执行过程中评估模型不可用，则仅将当前用例结果标记为失败。
- **变更内容**：
  - `packages/shared-database/prisma/schema.prisma`：新增 `app_evaluation_config` 表，保存应用评估模型、覆盖提示词开关和自定义提示词。
  - `apps/quality-business-service/src/app.service.ts`、`apps/quality-business-service/src/app.controller.ts`：新增 `/app/evaluation-config/detail.do` 与 `/app/evaluation-config/save.do`，返回系统默认提示词、当前生效提示词和应用配置状态。
  - `apps/quality-execution-service/src/execution.service.ts`：执行计划启动前校验应用评估配置、模型和供应商可用性；真实调用应用接口后，使用配置的 LLM 裁判提示词评估每条用例结果；裁判调用失败时仅标记当前结果失败并写入原因。
  - `apps/web/src/components/app-shell.tsx`、`apps/web/src/app/ai-quality-platform/apps/[appCode]/evaluation/page.tsx`、`apps/web/src/features/apps/app-evaluation.tsx`：应用内新增「评估配置」菜单和配置页面，支持选择可用 LLM 模型、启用覆盖提示词并保存。
  - 补充业务服务、执行服务和前端回归测试，覆盖配置保存、启动前阻断、执行中单条失败和页面表单交互。

### 2026-05-26 — 执行计划真实执行闭环

#### 新增与修复 — 执行计划、执行历史、历史详情接入真实协议与数据库结果
- **变更需求**：用户确认执行计划、执行历史、历史详情需要按真实接口和数据库数据设计开发，不能再使用占位执行结果。
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：执行计划启动时按已保存的计划过滤条件筛选应用用例，读取应用接口协议并真实调用 `invokeUrl`，将请求 JSON、响应 JSON、最终回答、评分依据、耗时和异常信息写入 `eval_result`。
  - `apps/quality-execution-service/src/execution.service.ts`：补充接口调用超时保护与 SSE `data:` 多段响应解析，即使协议未显式开启流式模式，也能拼接真实最终回答。
  - `apps/quality-execution-service/src/execution.service.spec.ts`：补充计划过滤、真实协议调用、SSE 响应解析和结果字段落库的回归测试。
  - `apps/web/src/features/apps/api/plan-execution-api.ts`：扩展执行结果类型，支持返回问题内容、期望回答、请求/响应 JSON、评分依据、耗时和错误信息。
  - `apps/web/src/features/apps/app-history-detail.tsx`：历史详情页改为展示真实问题内容、期望回答、模型实际返回、评分依据、请求 JSON 和响应 JSON，移除旧的占位评价文案。
  - `apps/web/src/features/apps/app-history-detail.spec.tsx`：补充历史详情真实字段展示的回归测试。

### 2026-05-26 — 执行历史详情页内容与样式开发

#### 新增与重构 — 执行历史详情页开发
- **变更需求**：用户反馈现有的执行历史详情页很简陋，要求增加完整的页面设计，包含统计分析图标和测试用例执行结果，且需要与当前工程风格一致，支持自适应主题切换。
- **变更内容**：
  - `apps/web/src/features/apps/app-history-detail.tsx`：重新实现了执行详情页，增加了总用例数、通过率等数据统计面板；实现了一个基于 SVG 的环形图来直观展示结果占比；优化了下方用例执行明细列表的排版，使其实际返回与评价理由展示更清晰。
  - 使用了标准 TailwindCSS 主题变量（如 `bg-card`, `border-border` 等）以支持系统的主题自适应。


### 2026-05-26 — 列表加载容错修复

#### 修复 — 执行计划列表不再被分类加载失败拖垮
- **变更需求**：用户反馈应用内「用例管理」和「执行计划」列表均显示加载失败；排查发现 case 服务未监听 3102，且执行计划页把计划列表和用例分类加载绑定在同一个失败分支。
- **变更内容**：
  - `apps/web/src/features/apps/app-plans.tsx`：计划列表与分类列表改为分别处理，分类加载失败时仍保留计划列表数据。
  - `apps/web/src/features/apps/app-plans.spec.tsx`：补充分类接口失败但计划列表可正常展示的回归测试。

#### 修复 — 侧边栏折叠状态兼容无 localStorage 的测试环境
- **变更需求**：完整运行前端测试时，测试环境没有可用 `localStorage`，导致 `AppShell` 测试失败。
- **变更内容**：
  - `apps/web/src/components/app-shell.tsx`：读取和写入侧边栏折叠状态时增加 `localStorage` 可用性保护。

#### 重构 — 用例字段收敛为问题分类、问题内容、期望回答
- **变更需求**：用户要求预置用例和应用用例不再维护用例名称、风险等级，仅保留「问题分类、问题内容、期望回答」三个业务属性。
- **变更内容**：
  - `apps/quality-case-service/src/case.service.ts`：后端创建、导入和更新用例时不再要求用例名称、风险等级，统一使用问题分类、问题内容和期望回答。
  - `packages/shared-database/src/seed.ts`：种子用例跟随三字段模型收敛，不再维护用例名称和风险等级。
  - `apps/web/src/features/cases/*`：预置用例列表、弹窗和 API 请求移除用例名称与风险等级，改用问题分类、问题内容、期望回答。
  - `apps/web/src/features/apps/app-cases.tsx`、`apps/web/src/features/apps/case-form-dialog.tsx`：应用用例展示与表单同步收敛为三字段。
  - 补充后端和前端回归测试，覆盖三字段创建、导入、展示与请求 payload。

#### 优化 — 分类筛选视图不再重复展示分类名
- **变更需求**：用户反馈在左侧已经选中具体分类时，右侧用例卡片和搜索栏旁不应重复显示同一个分类名称。
- **变更内容**：
  - `apps/web/src/features/cases/index.tsx`：预置用例仅在「全部用例」视图展示卡片分类 Badge，并移除搜索栏旁的选中分类说明。
  - `apps/web/src/features/apps/app-cases.tsx`：应用用例仅在「全部用例」视图展示卡片分类 Badge。
  - `apps/web/src/features/cases/index.spec.tsx`、`apps/web/src/features/apps/app-cases.spec.tsx`：补充分类型视图下分类名称不重复的回归测试。

### 2026-05-25 — 端到端流程打通 & 前端接口接入

#### 修复 — 接口配置页主内容宽度未铺满（2026-05-25）
- **变更需求**：用户反馈应用内「接口配置」页主内容过窄，宽屏下右侧留白过大。
- **变更内容**：
  - `apps/web/src/features/apps/app-protocol.tsx`：移除根容器 `max-w-3xl` 限宽，改为占满应用内容区。
  - `apps/web/src/features/apps/app-protocol.tsx`：请求配置与接口测试区域改为宽屏双栏、窄屏堆叠的响应式布局。

#### 删除/清理 — 移除 mock、造数脚本和过期占位代码（2026-05-25）
- **变更需求**：用户要求全面检查代码，删除无用代码、过期代码、mock 代码和造数据脚本。
- **变更内容**：
  - 删除 `apps/web/seed-real-data.mjs`、`apps/web/seed-more-cases.mjs`、`apps/web/test-fetch.mjs`、`apps/web/test-jsonpath.mjs` 等前端一次性造数/调试脚本。
  - 删除 `features/simple-list-page.*`、`features/gateway-list-page.*`、`features/gateway-server.ts` 这组早期通用列表旧实现。
  - 删除未被运行时代码引用的 UI 组件与相关依赖：`alert-dialog`、`avatar`、`card`、`data-table`、`empty-state`、`icon-button`、`skeleton`、`text-area`、`toast`。
  - 移除应用表单和接口配置页中的硬编码 mock 评估模型选择，以及对应未落库的类型字段。
  - 将工作台占位页替换为真实 `DashboardPage`，应用详情默认入口改为重定向到 `overview`。
  - 更新 `apps/web/AGENTS.md`，明确前端数据请求走真实 `api/`，禁止新增 mock-only 数据源和一次性造数脚本。

#### 修复 — next-themes 在服务端组件直接渲染导致的 React 报错（2026-05-25）
- **变更需求**：页面访问抛出错误 `Encountered a script tag while rendering React component`。
- **变更内容**：
  - `apps/web/src/components/theme-provider.tsx`：新建客户端组件，显式声明 `"use client"` 并封装 `next-themes` 的 `ThemeProvider`。
  - `apps/web/src/app/layout.tsx`：将直接引入 `next-themes` 改为引入封装好的客户端组件，修复由于服务端组件渲染包含 `<script>` 标签引起的报错。

#### 优化 — 应用用例列表界面布局与交互重设计（2026-05-25）
- **变更需求**：用户反馈上一次的布局调整不够精细，要求重新审视设计并合理排布；预置用例不应允许操作，自定义用例需支持编辑和删除；需要在左侧明确显示当前分类下的用例数量。
- **变更内容**：
  - `apps/web/src/features/apps/app-cases.tsx`：全面重构用例卡片布局，头部横向排布「用例名称、来源标签、风险等级」；内容区域采用带图标的区块化设计（`bg-muted/30` 和 `bg-emerald-500/5`），使用 Grid 布局规范「输入」与「期望行为」展示，并添加相关图标提升设计质感。
  - `apps/web/src/features/apps/app-cases.tsx`：左侧分类导航在当前选中的分类项右侧，增加显式的用例数量角标展示。
  - `apps/web/src/features/apps/app-cases.tsx`：为非系统预置的自建用例增加悬浮操作区（编辑、删除），删除操作接入了 `PopoverConfirm` 二次确认并调用 `/case/delete.do` 接口。
  - `apps/web/src/features/apps/case-form-dialog.tsx`：复用新建表单支持编辑模式。传入 `editingCase` 时回填数据，标题切换为“编辑应用测试用例”，并在提交时调用 `/case/update.do` 接口更新数据。

#### 新增/修复 — 应用用例分类创建与分类展示（2026-05-25）
- **变更需求**：用户反馈应用内用例管理左侧分类为空，并希望在应用内直接创建分类、向分类里新增用例。
- **变更内容**：
  - `apps/web/src/features/apps/app-cases.tsx`：应用用例分类查询改为同时包含全局分类，修复预置/全局分类不显示导致用例显示“未分类”的问题。
  - `apps/web/src/features/apps/app-cases.tsx`：新增“新建分类”入口与弹窗，调用 `/case/category/create.do` 创建当前应用范围分类，创建后自动选中新分类并刷新列表。
  - `apps/web/src/features/apps/case-form-dialog.tsx`：新建用例弹窗打开时按当前选中分类重置表单，确保新增用例落到当前分类。
  - `apps/web/src/features/apps/app-cases.spec.tsx`：补充应用分类展示、新建分类、新建用例归类的定向测试。

#### 优化 — 引用预置分类交互与接口重构（2026-05-25）
- **变更需求**：用户反馈按用例挑选太繁琐且弹窗太宽，希望直接按分类整体引入。
- **变更内容**：
  - `apps/quality-case-service/src/case.service.ts`：后端新增 `importPresetCategoriesToApp` 业务逻辑，支持通过 `categoryIds` 查找对应分类下所有系统预置用例并导入。
  - `apps/quality-case-service/src/case.controller.ts`：后端新增 `/case/preset/import-categories-to-app.do` 接口。
  - `apps/web/src/features/apps/app-cases.tsx`：彻底重构「从预置引用」弹窗，移除原有的左右分栏和用例列表，改为标准的居中小弹窗（`sm:max-w-md`）。
  - `apps/web/src/features/apps/app-cases.tsx`：弹窗内仅显示分类的多选列表，用户可勾选多个分类一键批量导入。


#### 优化 — 引用预置用例弹窗交互体验（2026-05-25）
- **变更需求**：引用预置用例的弹窗太窄内容显示不全，且用户希望按分类直接引用即可，不需要复杂的逐条选择和搜索操作。
- **变更内容**：
  - `apps/web/src/features/apps/app-cases.tsx`：增大弹窗最大宽度为 1100px。
  - 移除用例截断样式 (`truncate`) 改为换行完整显示 (`break-all whitespace-pre-wrap`)。
  - 移除右侧单个用例的复选框及相关状态 (`selectedIds`)。
  - 移除右侧搜索框、全选、清空功能，改为仅显示当前分类下包含的用例预览列表。
  - 底部确认按钮变更为「确认引用此分类 (X 条)」，一次性引入当前选中的整个分类的所有预览用例。



#### 修复 — execution-service 用例过滤逻辑
- **变更需求**：执行计划触发后 totalCount=0，系统预置用例无法被任何应用计划匹配
- **变更内容**：
  - `apps/quality-execution-service/src/execution.service.ts`：修正 `start()` 中的 appCode 过滤逻辑，`SYSTEM_PRESET` 用例对所有应用可见

#### 修复 — 应用接口协议 bodyTemplate 字段名错误
- **变更需求**：北京信用小京灵接口实际需要 `query` 字段，原来配置的是 `message`
- **变更内容**：通过 API 修正 `bodyTemplate` 为 `{"chatId":"","query":"{{case.query}}"}` 并补充 `accept: text/event-stream` Header

#### 新增 — 执行计划页前端接入真实后端数据
- **变更需求**：`app-plans.tsx` 和 `app-history.tsx` 原为静态空壳，无法展示真实计划和历史
- **变更内容**：
  - `features/apps/api/plan-execution-api.ts`：新增 `listPlans`、`createPlan`、`deletePlan`、`startPlan`、`listRuns`、`listResults` API
  - `features/apps/app-plans.tsx`：重写为真实数据驱动，支持加载计划列表、新建计划弹窗（含类型选择）、立即执行、删除
  - `features/apps/app-history.tsx`：重写为真实数据驱动，展示执行历史、通过率、平均分、待审比例

#### 删除 — 移除平台层一级菜单中的「执行计划」「执行记录」「评审」「报告」（2026-05-25）
- **变更需求**：这四个菜单已并入应用内部的子菜单，平台层不再需要
- **变更内容**：
  - `components/app-shell.tsx`：`NAV_ITEMS` 中移除执行计划、执行记录、人工复核、评估报告四个条目及对应图标导入
  - 删除路由目录：`app/ai-quality-platform/{plans,executions,reviews,reports}`
  - 保留应用内部子菜单中的「执行计划」「执行历史」功能不受影响

（阶段1：应用管理基础 + 二级导航）（2026-05-25）
- **变更需求**：设计并实现 AI 质量评测平台的 AI 应用模块，参照 promptfoo 架构
- **变更内容**：
  - `features/apps/` 旧文件全量删除（`app-catalog-page.tsx`、`app-detail-page.tsx`、`app-data.ts` 等）
  - `components/app-shell.tsx`：重构侧边栏为二级导航——进入应用后菜单切换为应用子菜单，平台菜单下沉到底部弱化显示；移除 `currentPath` prop 改用 `usePathname()`
  - `components/ui/popover-confirm.tsx`：新增删除确认气泡组件，用于应用内危险操作二次确认
  - `features/apps/types.ts`：完整类型定义（App/Assertion/AppCase/RunPlan/ExecutionRun 等），含评估模型三层继承设计
  - `features/apps/mock-hooks.ts`：Mock 数据 + CRUD Hooks（useApps/useApp/useAppCases/useRunPlans/useExecutionRuns）
  - `features/apps/app-list.tsx`：AI 应用列表页（卡片网格，展示通过率/用例数/计划数）
  - `features/apps/app-form-dialog.tsx`：应用创建/编辑弹窗（基本信息 Tab + 接口配置 Tab，含默认评估模型选择）
  - `features/apps/app-overview.tsx`：应用概览页（统计卡片 + 最近执行记录 + 评估模型信息）
  - `features/apps/app-protocol.tsx`：接口配置页（查看配置 + 接口测试发送）
  - `features/apps/app-cases.tsx`：用例管理页（展示用例和评估策略）
  - `features/apps/app-plans.tsx`：执行计划页（立即执行有二次确认）
  - `features/apps/app-history.tsx`：执行历史页（展示执行记录列表）
  - 路由结构：`/ai-quality-platform/apps/[appCode]/{overview,protocol,cases,plans,history}`

#### 修复 — 分类管理缺少编辑功能（2026-05-25）
- **变更需求**：分类管理行没有编辑按钮
- **变更内容**：
  - `features/cases/category-dialog.tsx`：支持编辑模式，传入 `editingCategory` 时自动回填名称/描述，标题和按钮随模式切换（"更新分类"）
  - `features/cases/index.tsx`：新增 `handleEditCategory` / `handleUpdateCategory`，分类行加 ✏️ 编辑按钮（排在启用/停用之前）

#### 新增 — 删除操作二次确认气泡 + 用例列表编辑/删除按钮（2026-05-25）
- **变更需求**：删除危险操作无确认提示直接调用接口；用例列表缺少编辑和删除按钮
- **变更内容**：
  - `components/ui/popover-confirm.tsx`：全量重写为 Tailwind 版本（警告图标 + 描述文字 + 取消/确认删除）
  - `features/cases/case-dialog.tsx`：支持编辑模式，传入 `editingCase` 时自动回填数据并显示"编辑"标题
  - `features/cases/index.tsx`：用例列表补充编辑（Pencil）和删除（Trash2）操作，删除用 `PopoverConfirm` 包裹；分类管理删除同样加确认气泡
  - `features/models/providers-panel.tsx`：供应商删除加 `PopoverConfirm` 确认
  - `features/models/models-panel.tsx`：模型删除加 `PopoverConfirm` 确认

#### 修复 — 预置用例分类管理缺少启用/停用操作（2026-05-25）
- **变更需求**：分类管理面板只显示状态，无法操作启用/停用
- **变更内容**：
  - `features/cases/index.tsx`：新增 `handleToggleCategory`（切换分类启用/停用，API 静默降级）
  - `features/cases/index.tsx`：新增 `handleDeleteCategory`（有用例时阻止删除并 toast 提示）
  - 分类管理行增加两个操作按钮：ToggleRight/ToggleLeft（启用/停用）和 Trash2（删除）


- **变更需求**：重写服务健康、模型中心、预置用例三块功能，使用 shadcn/Tailwind 技术栈
- **变更内容**：
  1. `components/ui/select.tsx` — 替换为 shadcn 完整版（SelectTrigger/Content/Item 等）
  2. `components/ui/tabs.tsx` — 替换为 shadcn 完整版（TabsList/Trigger/Content）
  3. `components/ui/dialog.tsx` — 替换为 shadcn 完整版（DialogHeader/Footer/Title 等）
  4. `components/ui/textarea.tsx` — 新建 shadcn 风格 Textarea
  5. `features/health/hooks.ts` — 新建 useHealthCheck hook（实际 HTTP 探测）
  6. `features/health/health-page.tsx` — 新建服务健康页面（统计卡片 + 行状态列表）
  7. `features/models/mock-hooks.ts` — 新建模型中心 mock 数据（3 供应商 + 4 模型）
  8. `features/models/provider-dialog.tsx` — 新建供应商创建/编辑弹窗
  9. `features/models/model-dialog.tsx` — 新建模型创建/编辑弹窗（LLM/Embedding 切换）
  10. `features/models/providers-panel.tsx` — 新建供应商面板（增删改停用/启用/测试）
  11. `features/models/models-panel.tsx` — 新建模型面板（能力 Badge、增删改停用/测试）
  12. `features/models/index.tsx` — 新建模型中心主页面（Tabs 切换）
  13. `features/cases/types.ts` — 新建预置用例类型定义
  14. `features/cases/mock-hooks.ts` — 新建预置用例 mock 数据（4 分类 + 6 用例）
  15. `features/cases/case-dialog.tsx` — 新建新增用例弹窗
  16. `features/cases/category-dialog.tsx` — 新建新增分类弹窗
  17. `features/cases/index.tsx` — 新建预置用例主页面（左侧分类筛选 + 右侧搜索列表 + 分类管理 Tab）
  18. 安装依赖：`@radix-ui/react-label`、`@radix-ui/react-scroll-area`

### 2026-05-25

#### 重构 — 技术栈对齐 design-deploy（2026-05-25）
- **全量替换 @heroui → 纯 Radix UI + shadcn + cva**
  - 变更文件：`package.json`、`src/app/globals.css`（新建）、`src/app/layout.tsx`、`src/app/providers.tsx`、`src/components/ui/*.tsx`（全量）、`src/components/app-shell.tsx`、`apps/web/AGENTS.md`
  - 变更内容：
    1. 删除 `@heroui/react`、`@heroui/styles`，安装 `class-variance-authority`、`tw-animate-css`
    2. 删除 `styles.css`（6000 行 @heroui 混合 CSS），新建 `globals.css`（130 行，`@import tailwindcss + tw-animate-css + oklch 颜色 + @theme inline`）
    3. `layout.tsx` 改用 `next/font/google` 的 Geist/Geist_Mono，注入 `--font-geist-sans` CSS 变量
    4. 全量替换 `components/ui/`：button(cva)、avatar、badge、card、input、label、separator、skeleton、sonner、tooltip 均与 design-deploy 完全一致
    5. `app-shell.tsx` 加入 `TooltipProvider`，折叠态 NavLink 自动显示 `side="right"` Tooltip
    6. 删除 `components/qtp-ui/`（@heroui 包裹组件）
    7. 所有功能页面内容存根（🚧 重构中），原代码备份至 `.bak.tsx`
    8. `AGENTS.md` 严格按 design-deploy 技术栈重写，删除所有旧描述噪音
  - 变更需求：系统字体/颜色/选中态/折叠 tooltip 与 design-deploy 完全对齐

#### 重构（大刀阔斧）

- **侧边栏彻底重构 - 抛弃 BEM 框架组件，全量 Tailwind CSS 重写**
  - 变更文件：`apps/web/src/components/app-shell.tsx`、`apps/web/src/components/ui/dropdown-menu.tsx`、`apps/web/src/components/sidebar/theme-toggle.tsx`、`apps/web/src/components/sidebar/user-menu.tsx`、`apps/web/src/app/styles.css`
  - 变更内容：（1）`app-shell.tsx` 完全重写，从 `position:fixed` + `padding-left` 改为 `flex h-screen` 布局，与 design-deploy 完全一致；所有 BEM 类（`.console-sidebar`、`.console-nav-item` 等）删除，改用纯 Tailwind CSS utility 类。（2）`dropdown-menu.tsx` 替换为完整 shadcn/tailwind 版本，`DropdownMenuContent` 自带 `z-50 bg-popover rounded-md border shadow-md` 等样式，dropdown 渲染立即可见，彻底修复点击无响应问题。（3）`ThemeToggle` 和 `UserMenu` 完全重写为 Tailwind 风格，与 design-deploy sidebar.tsx 1:1 对齐。（4）`styles.css` 增加 `@theme inline` 块，将 CSS 变量（`--background`、`--accent`、`--muted-foreground` 等）桥接到 Tailwind v4 颜色系统，使 `bg-accent`、`text-muted-foreground` 等 utility 类正确读取主题 Token。（5）验收通过：主题下拉菜单（浅色/深色/跟随系统）展开正常；用户菜单（用户名/角色/退出登录）展开正常；折叠态收缩为 `w-16` 仅显示图标；深色模式全局生效。
  - 变更需求：用户要求「大刀阔斧」对齐 design-deploy 风格，不受旧框架限制。

#### 新增

- **全系统暗色模式支持（参照 design-deploy 设计系统）**
  - 变更文件：`apps/web/src/app/styles.css`、`apps/web/src/app/providers.tsx`、`apps/web/src/app/layout.tsx`
  - 变更内容：接入 `next-themes`，`ThemeProvider` 以 `attribute="class"` 模式注入 `.dark` 类；CSS `:root` 全面改用语义化变量（`--background`, `--foreground`, `--primary` 等）；新增 `.dark {}` 块覆盖所有变量；`<html>` 添加 `suppressHydrationWarning` 避免 hydration 不匹配；body 背景/文字改为 CSS 变量引用；全局组件（卡片、表格、输入框、弹窗、dropdown）添加暗色模式规则。
  - 变更需求：用户要求深色模式覆盖整个系统。

- **侧边栏底部功能完善（主题切换 + 用户下拉菜单）**
  - 变更文件：`apps/web/src/components/sidebar/theme-toggle.tsx`（新建）、`apps/web/src/components/sidebar/user-menu.tsx`（新建）、`apps/web/src/components/ui/separator.tsx`（新建）
  - 变更内容：新建 `ThemeToggle` 组件（点击展开浅色/深色/跟随系统三选一下拉）；新建 `UserMenu` 组件（点击头像展开包含用户名、角色、退出登录的下拉菜单，退出调用 `/auth/logout.do` 后跳转登录页）；新建 `Separator` 组件封装 `@radix-ui/react-separator`；`app-shell.tsx` 底部集成 Separator→ThemeToggle→UserMenu→收起按钮。
  - 变更需求：用户要求侧边栏底部与参照项目一致（主题切换、用户信息操作、展开收起）。

- **AGENTS.md 工程规范文件**
  - 变更文件：`apps/web/AGENTS.md`（新建）、`AGENTS.md`（新建）
  - 变更内容：创建前端工程规范，涵盖技术栈、文件结构、CSS Token、字体规范、圆角规范、组件命名、暗色模式规范、API 规范、变更记录格式、禁止事项。
  - 变更需求：用户要求形成规则文件，确保后续开发者统一遵守。

#### 优化

- **侧边栏重构 v4 - 参照 design-deploy 方案，JSX 条件渲染彻底修复折叠乱码**
  - 变更文件：`apps/web/src/components/app-shell.tsx`、`apps/web/src/app/styles.css`
  - 变更内容：将所有折叠态文字隐藏从 CSS（opacity/display:none）改为 JSX 条件渲染（`{!collapsed && <span>}`），彻底消除折叠时文字换行显示为竖排乱码的问题；导航链接类名从直接 `a` 改为 `console-nav-item`，折叠态增加 `is-icon-only` 类实现图标居中；折叠态收起/展开图标从 PanelLeftClose/Open 改为 ChevronLeft/Right（与 design-deploy 一致）；CSS 层只负责尺寸过渡和视觉样式，不再做显隐控制。
  - 变更需求：用户反馈侧边栏折叠后文字竖排乱码，参考 `/Users/wumin/workspace/github/design-deploy` 项目实现。

- **侧边栏视觉重设计 - 对齐现代 SaaS 风格**
  - 变更文件：`apps/web/src/components/app-shell.tsx`、`apps/web/src/app/styles.css`
  - 变更内容：品牌区简化（紫色渐变图标 + 应用名）；Nav 链接圆角 0.5rem、平滑过渡；活跃项深色填充；底部用户行（头像+姓名+角色）+ 收起/展开按钮。
  - 变更需求：用户希望侧边栏风格更优雅，参考截图样式。

- **菜单切换导致页面整体刷新**
  - 变更文件：`apps/web/src/components/app-shell.tsx`、`apps/web/src/features/apps/app-catalog-page.tsx`、`apps/web/src/features/operations/operations-console-page.tsx`、`apps/web/src/features/management-console-page.tsx`
  - 变更内容：将所有站内路由跳转的原生 `<a href>` 标签全部替换为 Next.js 的 `<Link>` 组件。`<a>` 标签触发浏览器全量请求导致整页刷新，`<Link>` 实现客户端路由跳转（prefetch + 软导航），切换菜单时只有内容区域更新，layout/sidebar 不重新挂载。
  - 变更需求：用户反馈点击菜单页面整体重新加载，侧边栏不应重载。

#### 修复
- **移除左侧菜单栏重复图标导航**
  - 变更文件：`apps/web/src/components/app-shell.tsx`
  - 变更内容：去除 `console-rail`（蓝色图标条）中的 `console-rail-stack` 区域，该区域重复渲染了 `NAV_ITEMS` 的图标列表，与右侧 `console-sidebar` 中带文字的完整导航菜单造成视觉上的"两遍菜单"效果。Rail 现在只保留顶部汉堡折叠按钮和底部品牌标识 Q。
  - 同时移除了不再使用的 `activeRailHrefIndex` 变量。
  - 变更需求：用户反馈左侧菜单做了两遍，需删除冗余部分。

- **彻底移除 `console-rail` 蓝色细竖条**
  - 变更文件：`apps/web/src/components/app-shell.tsx`、`apps/web/src/app/styles.css`
  - 变更内容：完全删除 `console-rail` 的 `<aside>` 元素及其所有 CSS 规则（包括移动端媒体查询中的引用）。修正 `console-sidebar` 的 `left: 0`（原为 `left: var(--rail-width)`），`console-main-shell` 的 `padding-left` 改为只计算 sidebar 宽度。
  - 变更需求：用户反馈最左侧蓝色细竖条是多余的，整列删除。
