# Provider Module Contract

## 职责边界

- 管理模型供应商、模型配置、连接测试和计费参数。
- 保持 `/ai-quality-platform/provider/**` 公开控制器路径稳定，由 gateway 的 `ai` 段转发进入。
- 只维护配置，不承接执行过程中的裁判模型调用编排。

## 依赖规则

- 可以被 app 评估配置引用。
- 模型测试和执行阶段评估调用统一进入 `quality-ai-invocation-service`；platform 只依赖 `packages/ai-invocation-client` 和 `packages/ai-invocation-contract`，供应商协议细节只在 AI invocation 边界内由 `packages/ai-model-adapter` 处理。
- 不依赖 execution service 的运行状态。
