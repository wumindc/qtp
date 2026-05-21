# QTP 前端完全重构设计：HeroUI + TanStack + Next

## 背景

当前 `apps/web` 已经是 `Next 16 + React 19`，并使用了 Radix、TanStack Table、lucide、sonner 和项目内自研 UI 组件。问题不在于前端技术栈过旧，而在于现有前端更像“按页面逐步堆起来的管理端”：样式体系、数据请求、表格、弹窗、状态标签和页面布局存在重复，后续如果继续扩展 AI 应用、用例、计划、执行、报告等功能，维护成本会继续升高。

本次重构目标是功能不变，但前端代码、技术选型、组件体系、视觉体系和页面实现方式重新设计一遍。

## 目标

- 使用 HeroUI 作为主要视觉和基础交互组件库，获得更现代的管理端观感。
- 保留 Next App Router、React 19 和 monorepo 结构，避免无必要迁移。
- 引入 TanStack Query 作为统一数据请求、缓存、刷新、错误和加载态基础设施。
- 保留或增强 TanStack Table 在复杂后台表格中的能力，覆盖服务端分页、排序、筛选、批量选择和列配置。
- 建立项目内 `QTP UI Kit`，业务页面不直接散用 HeroUI，而是通过项目语义组件承接业务风格。
- 重写页面实现，但保持现有业务功能、接口语义、`.do` 后端接口和 `/ai-quality-platform` 路由上下文。

## 非目标

- 不重写后端服务。
- 不改变已有接口路径和 `.do` 后缀约定。
- 不把系统改成 antd-pro、Refine 或 React Admin 这类完整后台框架。
- 不做功能范围扩张；新视觉不等于新增业务功能。
- 不一次性删除旧前端再盲目重写，应先通过 POC 验证关键路径。

## 选型结论

推荐主路线：

`Next App Router + React 19 + HeroUI v3 + Tailwind CSS v4 + TanStack Query + TanStack Table + React Hook Form + Zod + lucide-react`

说明：

- HeroUI 当前适配 React 19 和 Tailwind v4，官方定位是基于 React Aria Components 的现代 React UI 组件库。
- HeroUI 适合承担按钮、输入框、选择器、弹窗、抽屉、Tabs、Toast、Card、Chip、基础 Table、Skeleton、Spinner 等基础体验。
- TanStack Query 承担接口状态，不再让页面组件到处直接 `fetch`。
- TanStack Table 承担复杂表格；HeroUI Table 可以用于简单表格，但复杂管理端表格应由项目封装层统一判断。
- React Hook Form + Zod 承担复杂表单和校验，HeroUI 只承担表单控件外观。

## 架构分层

### 1. App 层

位置：`apps/web/src/app`

职责：

- 保持 `/ai-quality-platform` 路由上下文。
- 定义 Next layout、provider、错误页、loading 边界和页面入口。
- 页面入口只连接 feature，不承载复杂业务实现。

### 2. Provider 层

建议位置：`apps/web/src/app/providers.tsx`

职责：

- 挂载 `HeroUIProvider`。
- 挂载 `QueryClientProvider`。
- 挂载 Toast、主题、路由跳转适配等全局能力。

### 3. QTP UI Kit 层

建议位置：`apps/web/src/components/qtp-ui`

职责：

- 封装项目语义组件，而不是让业务页面直接依赖第三方组件形态。
- 统一后台系统交互密度、圆角、颜色、动效、空态、错误态和中文文案习惯。
- 屏蔽 HeroUI API 变化对业务页面的影响。

第一批组件：

- `QButton`
- `QIconButton`
- `QTextField`
- `QSelect`
- `QTextarea`
- `QStatusChip`
- `QPageHeader`
- `QToolbar`
- `QDataTable`
- `QDrawer`
- `QModal`
- `QConfirmDialog`
- `QEmptyState`
- `QLoadingState`
- `QErrorState`

### 4. 数据层

建议位置：`apps/web/src/lib/api` 和 `apps/web/src/features/*/api`

职责：

- `lib/api/client.ts`：统一 gateway 请求、JSON 解析、错误模型、鉴权头、超时和基础配置。
- `lib/api/query-client.ts`：统一 TanStack Query 配置。
- `features/*/api/*.ts`：按业务模块封装接口函数。
- `features/*/queries.ts`：按业务模块封装 query keys、query hooks 和 mutation hooks。

接口调用原则：

- 页面组件不直接调用 `fetch`。
- `.do` 路径集中在模块 API 文件内。
- 错误展示统一走 `QErrorState`、Toast 或表单字段错误。

### 5. Feature 层

建议位置：`apps/web/src/features`

每个 feature 建议结构：

```text
features/apps/
  api/
    apps-api.ts
  components/
    app-form.tsx
    app-table.tsx
    app-toolbar.tsx
  pages/
    app-catalog-page.tsx
    app-detail-page.tsx
  queries.ts
  types.ts
```

职责：

- 以业务模块组织页面、组件、查询和类型。
- 页面组件只组合布局、业务组件和 hooks。
- 表格列、表单 schema、状态映射等业务规则留在 feature 内。

## 页面重写策略

优先级建议：

1. POC 页面：模型中心或 AI 应用目录。
2. 全局布局：侧边栏、顶部栏、用户区、全局搜索、面包屑、内容区。
3. 基础组件：Button、Input、Select、Dialog、Drawer、Toast、StatusChip、PageHeader、Toolbar。
4. 数据层：统一 API client、Query client、错误模型和请求 hooks。
5. 核心资源页：AI 应用、预置用例、模型中心、服务健康。
6. 流程页：测试计划、执行历史、评估报告、人工复核。
7. 回归和清理：删除旧 CSS、旧 UI 组件和页面内直接 fetch。

推荐 POC 选择：

- 首选：模型中心。
- 原因：它同时覆盖供应商、模型、列表、筛选、添加、编辑、删除、测试连接、弹窗表单和状态展示。
- 备选：AI 应用目录。
- 原因：它更接近普通资源管理页，适合作为批量迁移模板。

## 视觉原则

- 管理端以高信息密度、清晰层级、稳定布局为主，不做营销式大卡片首页。
- HeroUI 默认观感可作为起点，但需要为 QTP 定义更克制的后台主题。
- 主色建议使用专业、清晰的蓝或青蓝；避免整站变成单一紫蓝渐变风格。
- 卡片圆角保持克制，业务工具区优先使用表格、工具栏、分栏、抽屉和详情面板。
- 所有图标优先使用 `lucide-react`。
- 按钮、表格、筛选器和表单控件需要固定尺寸和响应式约束，避免加载态或长中文导致布局跳动。

## 测试策略

- Unit：Vitest 覆盖 API client、query hooks 的关键映射函数、状态转换和表单 schema。
- Component：React Testing Library 覆盖核心 QTP UI Kit 组件和 POC 页面关键交互。
- E2E：Playwright 覆盖登录、列表加载、筛选、新增、编辑、删除确认和错误态。
- Visual：POC 阶段至少验证桌面和移动宽度下无文字溢出、遮挡、空白页和控制台错误。
- Typecheck：每个阶段运行 `pnpm --filter web typecheck`。
- Build：每个阶段运行 `pnpm --filter web build`。

## POC 验收标准

POC 通过条件：

- HeroUI 在当前 pnpm monorepo 中安装、构建和运行稳定。
- Tailwind v4 与 Next 16 配置清晰，不引入不可解释的样式扫描问题。
- POC 页面能完成真实后端接口的数据加载、空态、错误态和刷新。
- 至少一个复杂表格场景跑通：分页、搜索、状态筛选、排序或批量选择。
- 至少一个复杂表单场景跑通：创建、编辑、字段校验、提交中、提交失败、成功刷新。
- 页面视觉明显优于当前实现，同时保持后台系统的信息密度。
- 没有明显控制台错误、布局遮挡、文字溢出或移动端不可用问题。

## 风险与应对

### HeroUI v3 生态成熟度

风险：HeroUI v3 较新，组件 API 和文档可能继续变化。

应对：

- 所有业务页面通过 `QTP UI Kit` 使用 HeroUI。
- POC 阶段重点验证 Table、Form、Drawer、Modal、Select 和 Toast。
- 锁定版本并记录升级策略。

### 复杂表格能力不足

风险：HeroUI Table 可能无法覆盖所有后台表格需求。

应对：

- 简单表格可用 HeroUI Table。
- 复杂表格统一走 `QDataTable`，内部优先 TanStack Table，必要时只借 HeroUI 的外观部件。

### 大规模一次性重写风险

风险：如果直接全量替换，容易长时间不可交付。

应对：

- 先 POC，再建立基础设施，再分模块迁移。
- 每个 feature 迁移后都能单独 build、typecheck 和页面验证。
- 保留旧实现直到对应页面新实现通过验收。

### 视觉好看但后台效率下降

风险：HeroUI 默认视觉偏精致，可能导致后台页面过松、信息密度不足。

应对：

- 在 QTP 主题中定义 compact 密度。
- 表格、工具栏、筛选区、详情区优先按管理端工作流设计。
- 不把页面做成卡片堆叠式展示。

## 推荐实施阶段

### Phase 0：POC 准备

- 安装并配置 HeroUI v3、Tailwind v4、Provider。
- 新建 `QTP UI Kit` 最小组件集。
- 新建 API client 和 Query client。

### Phase 1：POC 页面

- 重写模型中心或 AI 应用目录。
- 验证表格、表单、弹窗、抽屉、Toast、错误态、空态、真实接口。
- 输出 POC 结论：继续、调整或回退。

### Phase 2：基础设施固化

- 固化目录结构、主题 tokens、组件命名和 query key 规则。
- 增加测试基线和 Playwright 检查。
- 形成页面迁移模板。

### Phase 3：模块迁移

- AI 应用。
- 预置用例。
- 模型中心。
- 服务健康。
- 测试计划、执行历史、评估报告、人工复核。

### Phase 4：清理与回归

- 删除旧 UI 组件、旧 CSS 工具类和页面级重复实现。
- 统一错误、加载、空态和权限展示。
- 完成整站回归。

## 需要后续确认的问题

- POC 页面选择：模型中心还是 AI 应用目录。
- 是否需要暗色模式。
- 是否需要移动端完整可用，还是只保证平板/桌面。
- 权限体系是否只做前端菜单控制，还是需要细到按钮级。
- 是否要求保留当前页面路径完全不变。

## 建议结论

采用 `HeroUI + TanStack + Next/React 保留` 是当前最合适的路线。它能解决 antd/pro 风格老化的问题，也不会把系统完全绑定到一个 CRUD 框架。重构的关键不是“换一个更好看的库”，而是借 HeroUI 建立一套更现代、可维护、适合 QTP 业务复杂度的前端工程体系。
