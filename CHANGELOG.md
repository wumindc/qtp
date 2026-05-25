# Changelog

## [未发布]

### 2026-05-25 — 端到端流程打通 & 前端接口接入

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
  - `components/ui/popover-confirm.tsx`：新增 `trigger` prop 和 `confirmLabel` alias，向下兼容
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
