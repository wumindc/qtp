# Model Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将模型中心重构为以数据库 ID、模型能力和供应商参数模板为核心的正式模型资产管理模块。

**Architecture:** Prisma 保存供应商、模型资产和模型 JSON 参数；AI service 负责字段标准化、参数模板、连接测试和按 ID 操作模型；Next.js 前端使用统一表单组件渲染模型中心，并通过共享校验样式避免错位。

**Tech Stack:** Next.js 16、React 19、Radix UI、NestJS 11、Prisma、MySQL、Vitest、pnpm workspace。

---

### Task 1: 文档与表单规范

**Files:**
- Create: `docs/superpowers/specs/2026-05-21-model-center-redesign.md`
- Create: `docs/superpowers/plans/2026-05-21-model-center-redesign.md`
- Create: `docs/ui-form-guidelines.md`
- Modify: `apps/web/src/components/ui/text-input.tsx`
- Modify: `apps/web/src/components/ui/text-area.tsx`
- Modify: `apps/web/src/components/ui/select.tsx`
- Modify: `apps/web/src/app/styles.css`

- [ ] **Step 1: Add written model-center spec**

Save the approved design to `docs/superpowers/specs/2026-05-21-model-center-redesign.md`.

- [ ] **Step 2: Add UI form guidelines**

Document that console forms use `noValidate`, controlled errors, required markers, read-only visual states and reserved error space.

- [ ] **Step 3: Extend shared select field props**

Update `ConsoleSelect` to support `label`, `required`, `error` and `hint`, matching `TextInput`.

- [ ] **Step 4: Reserve error space globally**

Update `.ui-field__error` and field layout CSS so validation messages do not move neighboring fields.

- [ ] **Step 5: Run web form tests**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm --filter web test -- --run`

Expected: PASS.

### Task 2: Database and AI service model contract

**Files:**
- Modify: `packages/shared-database/prisma/schema.prisma`
- Modify: `apps/quality-ai-service/src/provider.service.ts`
- Modify: `apps/quality-ai-service/src/provider.controller.ts`
- Modify: `apps/quality-ai-service/src/provider.service.spec.ts`
- Modify: `apps/quality-ai-service/src/provider.controller.spec.ts`

- [ ] **Step 1: Update Prisma model schema**

Remove `AiModel.modelCode` and `AiModel.purpose`. Add `modelType`, `protocol`, `parametersJson`, `capabilitiesJson`, and `limitsJson`.

- [ ] **Step 2: Change model operations to database ID**

Use `id` for update, status change, test and delete. Keep `providerCode` as the supplier foreign key.

- [ ] **Step 3: Add parameter defaults**

Normalize model records with provider-specific defaults for OpenAI compatible, Qwen and DeepSeek LLMs, plus OpenAI compatible/Qwen embeddings.

- [ ] **Step 4: Test model calls by capability**

Use `/chat/completions` for LLM tests and `/embeddings` for embedding tests.

- [ ] **Step 5: Run AI service tests**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm --filter quality-ai-service test -- --run`

Expected: PASS.

### Task 3: Frontend model center redesign

**Files:**
- Modify: `apps/web/src/app/ai-quality-platform/providers/page.tsx`
- Modify: `apps/web/src/features/models/model-center-page.tsx`
- Modify: `apps/web/src/features/models/model-center-page.spec.tsx`
- Modify: `apps/web/src/app/styles.css`

- [ ] **Step 1: Remove model code and purpose from UI**

Tables, filters, forms and payloads use model `id`, `modelType`, `protocol`, parameter JSON and capability/limit JSON.

- [ ] **Step 2: Render model forms by provider and capability**

LLM forms show sampling, output and capability fields. Embedding forms show dimension, batch and encoding fields.

- [ ] **Step 3: Add controlled validation**

Model and provider dialogs use `noValidate` and controlled field error maps. Empty required fields should show inline error text without native browser bubbles.

- [ ] **Step 4: Preserve user-friendly empty states**

Empty table cells should show roomy empty states rather than cramped table text.

- [ ] **Step 5: Run web tests**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm --filter web test -- --run`

Expected: PASS.

### Task 4: Integration verification

**Files:**
- Modify as needed from earlier tasks.

- [ ] **Step 1: Generate Prisma client and push schema**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm db:generate && pnpm db:push`

Expected: Prisma succeeds against local MySQL.

- [ ] **Step 2: Typecheck**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm --filter quality-ai-service typecheck && pnpm --filter web typecheck`

Expected: PASS.

- [ ] **Step 3: Build web**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm --filter web build`

Expected: PASS.

- [ ] **Step 4: Health check**

Run: `eval "$(fnm env)" && fnm use 24 >/dev/null && pnpm check:health`

Expected: all services `UP`.

- [ ] **Step 5: Browser verification**

Open `http://127.0.0.1:3000/ai-quality-platform/providers`, verify model/provider tabs load, add-provider and add-model dialogs use aligned validation, and no native validation bubble appears.
