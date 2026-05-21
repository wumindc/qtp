# HeroUI Model Center POC Result

## Result

The Model Center POC uses HeroUI, QTP UI Kit wrappers, TanStack Query, and the existing backend `.do` endpoints. The slice keeps the existing `/ai-quality-platform/providers` route while moving model-center UI, data loading, mutation calls, and schema mapping into the new rewrite structure.

The implemented HeroUI v3 integration uses `@import "@heroui/styles";` at the app stylesheet boundary and HeroUI's `RouterProvider` in `AppProviders`. It does not use the earlier plan draft's Tailwind plugin entry or `HeroUIProvider`, because those exports are not available in the installed HeroUI v3 package shape.

## Verified Commands

- `pnpm --filter web test` - 16 files and 53 tests passed.
- `pnpm --filter web typecheck` - exited with code 0.
- `pnpm --filter web build` - exited with code 0 and kept `/ai-quality-platform/providers` as a dynamic route.
- `git diff --check` - exited with code 0 before result documentation.

## Browser Verification

- Page URL: `http://localhost:3000/ai-quality-platform/providers`
- Desktop viewport: `1440x900`
- Narrow viewport: `390x844`
- Desktop screenshot: `.playwright-cli/page-2026-05-21T10-45-33-623Z.png`
- Narrow screenshot: `.playwright-cli/page-2026-05-21T10-45-58-933Z.png`
- Interaction checked: opened the provider tab and the "添加供应商" modal.
- Console check after page load and modal interaction: 0 errors, 0 warnings.

## Decision

Continue the HeroUI + TanStack rewrite route. The POC passed unit tests, type checking, production build, and browser smoke checks after fixing the React Aria label and controlled-modal warning paths in the QTP UI Kit.

Before expanding to complex data-heavy pages, add a shared loading-error path for failed list queries and decide how much TanStack Table behavior should live inside `QDataTable`.
