# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Electron + Vue app in development mode.
- `npm run build` — run type checks and build the Electron app bundles into `out/`.
- `npm run preview` — preview the built Electron app.
- `npm run typecheck` — run `vue-tsc` for the renderer and `tsc` for Electron main/preload code.
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — run Vitest in watch mode.
- `npx vitest run src/renderer/src/composables/useTodos.test.ts` — run a single test file.

On networks where Electron binary downloads from GitHub are blocked, install dependencies with:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install --registry=https://registry.npmmirror.com
```

## Architecture

This is an Electron desktop app using `electron-vite` with three separate runtime areas:

- `src/main/` contains the Electron main process. It creates the `BrowserWindow`, configures secure renderer settings, opens external links through the OS browser, and loads either the dev server URL or the built renderer HTML.
- `src/preload/` contains the isolated preload bridge. Renderer-facing APIs should be exposed here through `contextBridge`; do not enable Node integration in the renderer.
- `src/renderer/` contains the Vue app. `src/renderer/index.html` is the renderer entry HTML, and `src/renderer/src/main.ts` mounts Vue.

The renderer currently implements a local-first todo list. State lives in `src/renderer/src/composables/useTodos.ts` and is persisted to `localStorage`; UI composition lives in `src/renderer/src/App.vue`.

Path alias `@renderer/*` points to `src/renderer/src/*` in both `electron.vite.config.ts` and TypeScript config.

## Testing

Vitest tests are discovered under `src/**/*.test.ts`. Existing tests cover the todo composable in `src/renderer/src/composables/useTodos.test.ts`.

## Claude Project Structure

- `CLAUDE.md` is the shared team guidance and should be committed.
- `CLAUDE.local.md` is for personal checkout-specific overrides and is ignored by git.
- `.claude/settings.json` is the shared project Claude Code configuration.
- `.claude/settings.local.json` is for personal project permissions/configuration and is ignored by git.
- `.claude/commands/` contains project slash commands such as `/project:review`, `/project:fix-issue`, and `/project:deploy`.
- `.claude/rules/` contains modular repository instructions. Apply these rules when working in their areas:
  - `code-style.md` for TypeScript, Vue, and Electron boundary style.
  - `testing.md` for verification expectations and commands.
  - `api-conventions.md` for preload bridge and future local API conventions.
  - `interaction.md` for user-facing response preferences.
  - `environment.md` for getting approval before changing the local dev environment.
  - `best-practices.md` for flagging when work should use a subagent, agent team, or be promoted to a rule/command/skill.
- `.claude/skills/` contains project workflow skills.
- `.claude/agents/` contains reusable subagent role definitions.

## Project Notes

- Use the preload bridge for any future filesystem, database, or OS integration instead of importing Node APIs in Vue components.
- Keep durable architecture notes and decisions in `docs/` when choices affect more than one file or session.
