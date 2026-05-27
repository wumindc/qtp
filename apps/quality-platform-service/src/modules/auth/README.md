# Auth Module Contract

## 职责边界

- 管理本地账号登录、当前用户和基础系统能力。
- 保持 `/ai-quality-platform/auth/**` 公开控制器路径稳定，由 gateway 的 `system` 段转发进入。
- 不承接业务配置、用例资产或执行状态。

## 依赖规则

- 可以读取用户表和基础权限信息。
- 业务模块只消费认证上下文，不直接反向写认证状态。
- 健康检查属于 platform 服务入口，不放入 auth 模块内部。
