# AGENTS.md — QTP Frontend 工程规范

> **唯一参照源**：`/Users/wumin/workspace/github/design-deploy`
> 本文件严格对照 design-deploy 技术栈编写，有冲突时以本文件为准。

---

## 技术栈（严格对照 design-deploy）

### 框架 & 运行时

| 库 | 版本 | 说明 |
|---|---|---|
| `next` | 16.x | App Router，`src/app/` 目录 |
| `react` / `react-dom` | 19.x | |
| `typescript` | 5.x | 严格模式 |

### UI 基础（Radix UI Primitives）

不使用任何 UI 框架（**禁止** @heroui、Chakra、MUI、Ant Design）。

| 包 | 用途 |
|---|---|
| `@radix-ui/react-avatar` | Avatar |
| `@radix-ui/react-dialog` | 弹窗 |
| `@radix-ui/react-dropdown-menu` | 下拉菜单 |
| `@radix-ui/react-label` | 表单标签 |
| `@radix-ui/react-scroll-area` | 自定义滚动区 |
| `@radix-ui/react-select` | 选择框 |
| `@radix-ui/react-separator` | 分割线 |
| `@radix-ui/react-slot` | asChild 模式 |
| `@radix-ui/react-tabs` | 标签页 |
| `@radix-ui/react-tooltip` | 工具提示（折叠导航必须） |

### 样式

| 库 | 说明 |
|---|---|
| `tailwindcss` v4 | 唯一样式系统，`@import "tailwindcss"` |
| `tw-animate-css` | 动画工具，`@import "tw-animate-css"` |
| `class-variance-authority` (cva) | 组件变体管理 |
| `tailwind-merge` + `clsx` | 通过 `cn()` 合并类名 |

**禁止** 手写内联 style（除 CSS 变量赋值场景）。

### 颜色系统

- 颜色格式：**`oklch()`**（与 design-deploy 完全一致）
- 设计 Token 定义在 `src/app/globals.css` 的 `:root` / `.dark` 块中
- Tailwind 通过 `@theme inline` 读取 CSS 变量
- **禁止** 使用 `#hex` 或 `rgb()` 直接写颜色

### 字体

```tsx
// src/app/layout.tsx
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

// body className:
className={`${geistSans.variable} ${geistMono.variable} antialiased`}
```

CSS 中通过 `--font-sans: var(--font-geist-sans)` 引用。

### 主题切换

- 使用 `next-themes`，`ThemeProvider attribute="class"`
- `:root` 为亮色，`.dark` 为暗色（class 模式）
- 初始主题：`system`

### Toast 通知

- `sonner` + `next-themes` 感知主题
- 组件：`src/components/ui/sonner.tsx`

### 图标

- `lucide-react`
- 大小规范：`h-4 w-4`（按钮内）、`h-5 w-5`（导航图标）

---

## 项目结构

```
apps/web/src/
├── app/
│   ├── globals.css          # 全局样式（唯一 CSS 入口）
│   ├── layout.tsx           # 根布局（字体 + ThemeProvider + Toaster）
│   └── ai-quality-platform/ # 平台路由
│       ├── layout.tsx       # 平台布局（PlatformLayout）
│       ├── page.tsx         # 工作台
│       ├── apps/            # AI 应用
│       ├── cases/           # 预置用例
│       ├── plans/           # 测试计划
│       ├── executions/      # 执行历史
│       ├── reviews/         # 人工复核
│       ├── reports/         # 评估报告
│       ├── providers/       # 模型中心
│       └── health/          # 服务健康
├── components/
│   ├── app-shell.tsx        # 侧边栏 + 内容区主框架
│   ├── platform-layout.tsx  # 路由判断（登录页跳过 AppShell）
│   ├── sidebar/
│   │   ├── theme-toggle.tsx # 主题切换（含 Dropdown）
│   │   └── user-menu.tsx    # 用户菜单（含 Dropdown + 退出登录）
│   └── ui/                  # shadcn 风格基础组件（对应 design-deploy/ui/）
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx       # cva 变体
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       ├── sonner.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx      # 折叠导航 Tooltip
├── features/                # 功能模块（按页面拆分）
│   └── {module}/
│       ├── index.tsx        # 主视图
│       ├── hooks.ts         # 服务端数据（真实 API）
│       └── mock-hooks.ts    # 静态模拟数据
└── lib/
    ├── cn.ts                # cn() = twMerge + clsx
    └── api/                 # HTTP 客户端 + query-client
```

---

## 编码规范

### 组件

- 每个功能页面拆分多个独立 `.tsx` 文件，通过 import 引入
- 视图和数据分离：视图在 `index.tsx`，数据在 `hooks.ts` / `mock-hooks.ts`
- 每个文件顶部注释包含 `@author` 字段

### 样式

- 只用 Tailwind utility 类，**不写自定义 CSS class**
- 动态类使用 `cn()` 合并：`className={cn('...', condition && '...')}`
- 变体用 `cva`：参考 `button.tsx`

### 导航侧边栏

- 展开宽度：`w-[220px]`
- 折叠宽度：`w-16`
- 折叠态 nav item 必须用 `Tooltip side="right"` 显示名称
- 折叠态 theme/user 按钮同理加 Tooltip

### 列表/表格

- 列宽**不设置固定值**，由列表自动计算

### 包管理

- 使用 `pnpm`（workspace 模式）
- **禁止** 使用 npm / yarn
- 安装：`pnpm add --filter web <package>`

---

## 变更记录

每次变更写入根目录 `CHANGELOG.md`，格式：

```markdown
### YYYY-MM-DD

#### [类型]（新增/修复/重构/删除）
- **标题**
  - 变更文件：`xxx.tsx`
  - 变更内容：...
  - 变更需求：...
```
