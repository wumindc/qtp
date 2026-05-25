# QTP Semi 前端重做标准规范

## 目标

本轮重做采用新工程 `apps/semi-web`，不在原 `apps/web` 中直接改造。第一阶段先建立 Semi Design 的工程骨架、菜单骨架、通用状态与动效标准，再按菜单逐页迁移。

## 技术基线

- 框架：Vite + React + TypeScript。
- UI：`@douyinfe/semi-ui` + `@douyinfe/semi-icons`。
- 数据状态：`@tanstack/react-query`。
- 开发数据：默认 mock fixture，接口路径保持 Gateway 的 `.do` 语义。
- 联调数据：后续通过环境开关切换真实 `http://127.0.0.1:8080/ai-quality-platform/api/**`。
- 访问路径：`/ai-quality-platform`，端口先用 `3001`，避免和旧前端 `3000` 冲突。

## 页面推进顺序

1. 全局骨架：侧边导航、顶栏、内容区、登录页外壳。
2. 工作台：指标卡、质量链路、状态标准展示。
3. AI 应用目录：搜索、筛选、表格、新建弹窗、进入工作区。
4. AI 应用工作区：概览、接入配置、测试用例，后续扩到计划、执行、报告。
5. 预置用例：列表、分类、启停、导入应用。
6. 模型中心：模型、供应商、测试连接、启停和配置弹窗。
7. 服务健康与登录：真实探活、登录态、权限态。

## 状态标准

每个页面必须覆盖以下状态：

- 骨架屏：列表、表格、表单加载时优先使用 `StandardSkeleton`。
- 加载中：操作级阻塞用 Semi `Spin`，页面级加载用骨架屏。
- 空态：用 `StandardEmpty`，说明当前筛选条件或业务状态。
- 错误态：用 `StandardError`，必须提供重试入口。
- 成功反馈：用 Semi `Toast.success`，文案保持短句。
- 表单校验：字段旁提示优先，提交失败再 Toast。

## 动效标准

- 页面切换使用 220ms 以内的淡入上移。
- hover 和选中态使用 140ms 以内的颜色/背景变化。
- 遵守 `prefers-reduced-motion`，禁用非必要动画。
- 动效只用于说明层级和状态变化，不做装饰性大幅运动。

## 布局标准

- 管理端优先信息密度和可扫描性，不做营销式首页。
- 页面宽度使用统一内容容器，表格和工具栏保持稳定尺寸。
- 卡片圆角控制在 8px 到 12px；不允许卡片套卡片。
- 表格页采用“页面标题 + 工具栏 + 表格/状态”的固定结构。
- 表单页采用两列栅格，小屏自动单列。

## 组件标准

- 业务页优先使用 Semi 原生组件，不再延续旧 `components/ui/*` 和 HeroUI 包装层。
- 公共状态、布局、状态色、表格辅助组件沉淀在 `apps/semi-web/src/components`。
- 业务数据类型和 mock 先放 `apps/semi-web/src/data`，后续按 feature 拆分。
- 每个 Codex 新增代码文件至少包含一处 `@author codex` 注释，符合仓库约束。

## 验收标准

- `pnpm --filter semi-web typecheck` 通过。
- `pnpm --filter semi-web test` 通过。
- `pnpm --filter semi-web build` 通过。
- 本地页面可在 `http://127.0.0.1:3001/ai-quality-platform` 打开。
- 左侧菜单、登录、应用目录、应用工作区 tabs、模型中心、健康页可点击切换。
- 每个页面至少具备加载态、空态或错误态中的对应标准组件。
