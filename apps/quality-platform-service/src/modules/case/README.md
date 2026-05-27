# Case Module Contract

## 职责边界

- 管理系统预置用例、应用用例、分类、订阅关系、CSV/Excel 导入导出。
- 保持 `/ai-quality-platform/case/**` 公开控制器路径稳定，由 gateway 的 `case` 段转发进入。
- 用例快照由 execution service 在执行时固化，本模块只维护当前资产版本。

## 依赖规则

- 可以读取应用编码用于作用域过滤。
- 不依赖 plan、execution、report 模块。
- 向其他模块输出稳定的用例编码、分类编码和最小字段契约。
