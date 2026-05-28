# Auth Module Contract

## 职责边界

- 管理本地账号登录、当前用户和基础系统能力。
- 保持 `/ai-quality-platform/auth/**` 公开控制器路径稳定，由 gateway 的 `system` 段转发进入。
- 不承接业务配置、用例资产或执行状态。

## 依赖规则

- 可以读取用户表和基础权限信息。
- 密码必须以哈希形式存储，管理员初始密码只能通过 seed 环境变量显式提供。
- 登录返回由 `packages/shared-auth` 生成的签名 token，gateway 负责校验业务 API 登录态。
- 业务模块只消费认证上下文，不直接反向写认证状态。
- 健康检查属于 platform 服务入口，不放入 auth 模块内部。
