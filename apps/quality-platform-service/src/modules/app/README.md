# App Module Contract

## 职责边界

- 管理 AI 应用基础信息、协议配置、评估配置和应用级统计聚合。
- 保持 `/ai-quality-platform/app/**` 公开控制器路径稳定，由 gateway 的 `business` 段转发进入。
- 不直接执行测试批次；执行只通过 execution service 的公开 API 触发。

## 依赖规则

- 可以读取应用相关数据库表和模型配置引用。
- 可以为列表和详情聚合 case、plan、run 的只读统计。
- 不反向依赖 report 模块，不持有 worker 状态。
