# AGENTS.md — QTP 项目根规范

> 本文档约束整个 QTP monorepo 的工程规范。
> 前端详细规范见 [apps/web/AGENTS.md](./apps/web/AGENTS.md)。

---

## 项目结构

```
QTP/
├── apps/
│   └── web/                # Next.js 前端（主应用）
├── packages/
│   └── shared-config/      # 共享配置（API URL 等）
├── CHANGELOG.md            # 项目级变更记录
├── docs/                   # 设计文档（命名：YYYYMMDD-NNN-标题.md）
└── AGENTS.md               # 本文件
```

## 包管理

- **工具**：pnpm（workspace 模式）
- **安装依赖**：`pnpm add --filter web <package>`
- **禁止**：不得使用 npm / yarn 直接安装

## 变更记录

每次变更写入根目录 `CHANGELOG.md`，格式参见 `apps/web/AGENTS.md`。

## 文档

- 存储位置：`docs/`
- 命名格式：`YYYYMMDD-NNN-标题.md`（如 `20260525-001-暗色模式设计.md`）
