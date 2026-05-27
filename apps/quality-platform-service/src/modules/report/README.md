# Report Module Contract

## 职责边界

- 汇总工作台、应用概览、执行报告和质量统计数据。
- 保持 `/ai-quality-platform/report/**` 公开控制器路径稳定，由 gateway 的 `statistics` 段转发进入。
- 只做读模型和报告生成，不承接业务写入主流程。

## 依赖规则

- 可以只读汇总 app、case、plan、execution、review 的结果数据。
- 普通业务模块不要反向依赖 report。
- 统计口径变化需要同步页面和回归测试。
