# Contributing to QTP

Thanks for helping improve QTP. The project is still early, so the most useful contributions are focused: make the north-star demo clearer, make setup easier, or deepen the regression diagnosis loop.

## Project Direction

Start with these files:

1. [README.md](./README.md) for the public product story and local setup.
2. [ROADMAP.md](./ROADMAP.md) for staged product direction.
3. [docs/20260601-001-开源化与功能任务规划.md](./docs/20260601-001-开源化与功能任务规划.md) for open-source readiness and task breakdown.

## Development Setup

Requirements:

- Node.js 24
- pnpm 11+

Run:

```bash
pnpm setup
pnpm dev
```

The app starts at `http://127.0.0.1:3000/ai-quality-platform`.

## Verification

Before opening a PR, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For UI changes, include screenshots or a short recording. For database or seed changes, explain how reviewers can rebuild local state.

## Branches and Commits

- Use a focused branch name such as `codex/open-source-readiness` or `feat/context-regression`.
- Keep unrelated changes out of the PR.
- Write commit messages that name the user-facing change, for example `docs: add contributor guide` or `fix: align ci scripts with monolith setup`.

## Pull Requests

Every PR should include:

- What changed.
- Why it changed.
- How it was verified.
- Screenshots for UI changes.
- Documentation and changelog updates when behavior, setup, roadmap, or public project shape changes.

## Coding Notes

- Use pnpm, not npm or yarn.
- Follow [AGENTS.md](./AGENTS.md) and [apps/web/AGENTS.md](./apps/web/AGENTS.md).
- Keep changes scoped to the current task.
- Prefer real seeded data over mock-only data sources.
