# AI Quality Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade phase of `ai-quality-platform` with a Next.js frontend, multiple NestJS services, MySQL, Redis, Prisma, health checks, login, application management, cases, plans, execution, review, and reports.

**Architecture:** Use a pnpm workspace monorepo with one Next.js web app, a unified public gateway entry, and independent NestJS service apps behind that gateway. Each service exposes `.do` APIs under `/ai-quality-platform`, connects to shared MySQL through Prisma, and uses shared configuration helpers; execution and AI scoring use Redis queues.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui style components, NestJS, Prisma, MySQL, Redis, BullMQ, Vitest/Jest, pnpm workspace.

---

## File Structure

- `package.json`: root workspace scripts and package manager metadata.
- `pnpm-workspace.yaml`: workspace package discovery.
- `tsconfig.base.json`: shared TypeScript configuration.
- `.gitignore`: dependency, build, env, and generated file ignores.
- `.env.example`: local service port, MySQL, Redis, JWT, and model provider examples.
- `docs/ai-quality-platform-design.md`: source product and architecture design.
- `apps/web`: Next.js frontend mounted at `/ai-quality-platform`.
- `apps/quality-business-service`: AI app and adapter configuration service.
- `apps/quality-case-service`: test case service with Excel import/export.
- `apps/quality-plan-service`: test plan service.
- `apps/quality-execution-service`: run and queue orchestration service.
- `apps/quality-ai-service`: provider configuration and LLM judge service.
- `apps/quality-review-service`: manual review service.
- `apps/quality-statistics-service`: dashboard and report service.
- `apps/quality-system-service`: local account, auth, RBAC, dictionaries, logs.
- `packages/shared-config`: environment parsing, internal service ports, public gateway URL, CORS, context path.
- `packages/shared-types`: DTOs and shared enums.
- `packages/shared-database`: Prisma schema, migrations, seed helpers.
- `packages/shared-logger`: logger factory and request logging helpers.
- `packages/shared-auth`: JWT helpers and auth guards.
- `packages/shared-http`: response wrappers, pagination, health check helpers.

## Task 1: Workspace And Shared Configuration Skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared-config/package.json`
- Create: `packages/shared-config/tsconfig.json`
- Create: `packages/shared-config/src/index.ts`
- Create: `packages/shared-config/src/config.spec.ts`
- Create: `packages/shared-http/package.json`
- Create: `packages/shared-http/tsconfig.json`
- Create: `packages/shared-http/src/index.ts`
- Create: `packages/shared-http/src/response.spec.ts`

- [ ] **Step 1: Install pnpm**

Run: `npm install -g pnpm`

Expected: command exits 0 and `pnpm -v` prints a version.

- [ ] **Step 2: Write failing tests for shared config and response wrappers**

Create `packages/shared-config/src/config.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONTEXT_PATH, getPublicApiUrl, getServicePort } from './index';

describe('shared config', () => {
  it('uses the ai-quality-platform context path', () => {
    expect(CONTEXT_PATH).toBe('ai-quality-platform');
  });

  it('returns planned local service ports', () => {
    expect(getServicePort('web')).toBe(3000);
    expect(getServicePort('business')).toBe(3101);
    expect(getServicePort('system')).toBe(3108);
  });

  it('builds public API URLs through the unified gateway port', () => {
    expect(getPublicApiUrl('business', '/app/list.do')).toBe(
      'http://127.0.0.1:8080/ai-quality-platform/api/business/app/list.do',
    );
  });
});
```

Create `packages/shared-http/src/response.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ok, pageResult } from './index';

describe('shared http response helpers', () => {
  it('wraps a successful response in the platform envelope', () => {
    expect(ok({ id: 1 })).toEqual({
      code: 0,
      success: true,
      message: 'ok',
      data: { id: 1 },
    });
  });

  it('wraps a paged list with platform pagination fields', () => {
    expect(pageResult([{ id: 1 }], 1, 10, 1)).toEqual({
      list: [{ id: 1 }],
      page: {
        totalNum: 1,
        currentPage: 1,
        linesPerPage: 10,
        totalPage: 1,
      },
    });
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `pnpm test`

Expected: FAIL because workspace packages and implementation do not exist yet.

- [ ] **Step 4: Implement minimal workspace and shared packages**

Create the root workspace files, shared config helpers, and response helpers. Include `@author codex` comments in source files.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `pnpm test`

Expected: PASS for shared package tests.

## Task 2: Shared Database With Prisma And Seed Data

**Files:**
- Create: `packages/shared-database/package.json`
- Create: `packages/shared-database/prisma/schema.prisma`
- Create: `packages/shared-database/src/index.ts`
- Create: `packages/shared-database/src/seed.ts`
- Create: `packages/shared-database/src/seed.spec.ts`

- [ ] **Step 1: Write failing seed tests**

Test default admin, 10 case categories, one demo app, three demo plans, and sample report seed definitions.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @ai-quality-platform/shared-database test`

Expected: FAIL because seed helpers are missing.

- [ ] **Step 3: Implement Prisma schema and seed helpers**

Add users, apps, adapters, model providers, cases, plans, runs, results, reviews, reports, and dictionaries.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter @ai-quality-platform/shared-database test`

Expected: PASS.

## Task 3: NestJS Service Template And Health Checks

**Files:**
- Create one NestJS app for each service under `apps/quality-*-service`.
- Add `src/main.ts`, `src/app.module.ts`, `src/health.controller.ts`, and `src/health.controller.spec.ts` for each service.

- [ ] **Step 1: Write failing health check tests**

Each service test calls `GET /ai-quality-platform/health.do` and expects service name, `UP` status, database status, Redis status, and platform envelope.

- [ ] **Step 2: Run RED**

Run: `pnpm test`

Expected: FAIL because service apps are not implemented.

- [ ] **Step 3: Implement shared NestJS bootstrap and health endpoints**

Use shared config for CORS and context path. Every service listens on its planned port.

- [ ] **Step 4: Run GREEN**

Run: `pnpm test`

Expected: service health check tests pass.

## Task 4: Web App Shell And Service Health Page

**Files:**
- Create: `apps/web`
- Create dashboard layout, sidebar, route base path, health page, service client, and tests.

- [ ] **Step 1: Write failing frontend tests**

Test that the shell renders the sidebar and that the health page lists all eight backend services.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter web test`

Expected: FAIL.

- [ ] **Step 3: Implement Next.js app shell**

Create a modern SaaS layout using Tailwind and local shadcn-style components.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter web test`

Expected: PASS.

## Task 5: Local Account Login

**Files:**
- Modify: `apps/quality-system-service`
- Modify: `apps/web`
- Test: system service auth tests and web login tests.

- [ ] **Step 1: Write failing login tests**

Test `admin / admin123456` login returns a token and invalid credentials return an error.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-system-service test`

Expected: FAIL.

- [ ] **Step 3: Implement login**

Add user repository, password verification, JWT issuance, login page, and login state.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-system-service test && pnpm --filter web test`

Expected: PASS.

## Task 6: AI Application Management With Adapter Configuration

**Files:**
- Modify: `apps/quality-business-service`
- Modify: `apps/web`
- Test: business service CRUD tests and web page tests.

- [ ] **Step 1: Write failing app CRUD and adapter tests**

Test create, update, enable/disable, delete, list, adapter JSON validation, and connection test.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-business-service test`

Expected: FAIL.

- [ ] **Step 3: Implement AI application management**

Persist app metadata and adapter JSON. Add full web CRUD page.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-business-service test && pnpm --filter web test`

Expected: PASS.

## Task 7: Model Provider Management

**Files:**
- Modify: `apps/quality-ai-service`
- Modify: `apps/web`
- Test provider CRUD and connection test behavior.

- [ ] **Step 1: Write failing provider tests**

Cover OpenAI-compatible, Qwen, and DeepSeek provider configuration.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-ai-service test`

Expected: FAIL.

- [ ] **Step 3: Implement provider management**

Add encrypted API key storage placeholder, provider CRUD, enable/disable, and connection test endpoint.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-ai-service test && pnpm --filter web test`

Expected: PASS.

## Task 8: Test Case Management And Excel Import/Export

**Files:**
- Modify: `apps/quality-case-service`
- Modify: `apps/web`
- Test CRUD, category seed, Excel template, import, and export.

- [ ] **Step 1: Write failing case and Excel tests**

Cover full-field template generation, valid import, invalid row validation, and export.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-case-service test`

Expected: FAIL.

- [ ] **Step 3: Implement case management**

Add CRUD, full field schema, category dictionary, Excel template download, import, and export.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-case-service test && pnpm --filter web test`

Expected: PASS.

## Task 9: Test Plan Management

**Files:**
- Modify: `apps/quality-plan-service`
- Modify: `apps/web`
- Test plan CRUD and case filter matching.

- [ ] **Step 1: Write failing plan tests**

Cover smoke, regression, high-risk, RAG, and custom filters.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-plan-service test`

Expected: FAIL.

- [ ] **Step 3: Implement plans**

Add plan CRUD, filter preview, and web pages.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-plan-service test && pnpm --filter web test`

Expected: PASS.

## Task 10: Execution Queue And Tested App Invocation

**Files:**
- Modify: `apps/quality-execution-service`
- Modify: `apps/web`
- Test queue creation, JSON response adapter, SSE response adapter, result persistence, cancel, and rerun.

- [ ] **Step 1: Write failing execution tests**

Cover task creation from plan, Redis queue job payload, ordinary JSON adapter, SSE adapter aggregation, timeout, and error event.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-execution-service test`

Expected: FAIL.

- [ ] **Step 3: Implement execution service**

Add queues, workers, adapter engine, JSON/SSE HTTP client, run status updates, result persistence, cancel, and rerun.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-execution-service test && pnpm --filter web test`

Expected: PASS.

## Task 11: Automatic Scoring

**Files:**
- Modify: `apps/quality-ai-service`
- Modify: `apps/quality-execution-service`
- Modify: `apps/web`
- Test rule scoring, LLM judge request building, category templates, and score aggregation.

- [ ] **Step 1: Write failing scoring tests**

Cover must-include, must-not-include, format checks, classification templates, and provider call abstraction.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-ai-service test`

Expected: FAIL.

- [ ] **Step 3: Implement scoring**

Add rule engine, LLM judge prompt templates, provider client interface, score persistence, and final status decision.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-ai-service test && pnpm --filter quality-execution-service test && pnpm --filter web test`

Expected: PASS.

## Task 12: Manual Review

**Files:**
- Modify: `apps/quality-review-service`
- Modify: `apps/web`
- Test review list, submit, status update, problem type, and add-to-regression behavior.

- [ ] **Step 1: Write failing review tests**

Cover PASS, FAIL, NEED_BUSINESS_CONFIRM, NEED_DEV_INVESTIGATION, and ADD_TO_REGRESSION.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-review-service test`

Expected: FAIL.

- [ ] **Step 3: Implement review center**

Add review APIs and web workbench.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-review-service test && pnpm --filter web test`

Expected: PASS.

## Task 13: Reports And Dashboard

**Files:**
- Modify: `apps/quality-statistics-service`
- Modify: `apps/web`
- Test dashboard metrics, report summary, category pass rate, high-risk failures, and typical cases.

- [ ] **Step 1: Write failing statistics tests**

Cover report metrics built from seeded run results.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter quality-statistics-service test`

Expected: FAIL.

- [ ] **Step 3: Implement statistics and reports**

Add dashboard endpoints, report endpoints, and frontend pages.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter quality-statistics-service test && pnpm --filter web test`

Expected: PASS.

## Task 14: Docker Local Deployment

**Files:**
- Create: `Dockerfile` files for web and services.
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Modify: docs with startup instructions.

- [ ] **Step 1: Write deployment verification script**

Add a script that checks web and all service health URLs.

- [ ] **Step 2: Run RED**

Run: deployment script before Docker files exist.

Expected: FAIL.

- [ ] **Step 3: Implement Docker compose deployment**

Add images, env wiring, MySQL, Redis, and health checks.

- [ ] **Step 4: Run GREEN**

Run: `docker compose up --build` and the deployment verification script.

Expected: all health checks return UP.

## Self-Review

- Spec coverage: The plan covers the confirmed frontend stack, pnpm workspace, multi-service NestJS backend, MySQL, Redis, Prisma, local login, model providers, non-uniform tested app protocols, streaming adapters, CORS, health page, Excel import/export, seed data, review, reports, and Docker.
- Placeholder scan: No implementation step depends on an undefined future task; broad tasks will be executed one feature at a time with TDD.
- Type consistency: Service names, ports, context path, response envelopes, and first-phase feature names match `docs/ai-quality-platform-design.md`.
