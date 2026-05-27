# Review Module Contract

## 职责边界

- 管理人工复核、人工判定、复核备注和恢复 AI 原始评估结果。
- 保持 `/ai-quality-platform/review/**` 公开控制器路径稳定，由 gateway 的 `review` 段转发进入。
- 不重新执行用例，也不直接修改执行 worker 阶段。

## 依赖规则

- 可以读取执行结果标识并写入复核记录。
- 不依赖 app、case、plan 的可变配置。
- 报表和详情页可只读聚合复核结论。
