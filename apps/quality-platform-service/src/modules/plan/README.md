# Plan Module Contract

## 职责边界

- 管理执行计划定义、用例筛选条件和执行前预览。
- 保持 `/ai-quality-platform/plan/**` 公开控制器路径稳定，由 gateway 的 `plan` 段转发进入。
- 不在本模块内推进执行状态；启动后的生命周期归 execution service。

## 依赖规则

- 可以只读查询 case 模块维护的用例资产，用于计划预览。
- 可以读取应用编码以校验计划归属。
- 不依赖 review、report 和 provider 模块。
