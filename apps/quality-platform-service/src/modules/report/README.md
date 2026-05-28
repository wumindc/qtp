# Report Module Contract

## 职责边界

- 汇总工作台和质量统计数据。
- 保持 `/ai-quality-platform/report/dashboard.do` 公开控制器路径稳定，由 gateway 的 `statistics` 段转发进入。
- 只做真实业务表只读聚合，不生成离线报告快照。

## 依赖规则

- 可以只读汇总 app、case、plan、execution、review 的结果数据。
- 普通业务模块不要反向依赖 report。
- 统计口径变化需要同步页面和回归测试。
