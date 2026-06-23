# LocalTodo

LocalTodo is a local-first desktop todo app built with Electron, Vue, TypeScript, and electron-vite.

## Using the app

If you just want to use LocalTodo (not develop it), start here:

- [用户使用说明 / User guide](docs/user-guide.md) — 完整功能说明（中文），含「第一次使用」上手步骤。
- [配合 Claude Code 使用 / Using with Claude Code](docs/using-with-claude-code.md) — 把任务上下文交给 Claude Code 等 AI 工具的协作流程。

The sections below are for developing LocalTodo itself.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
```

If Electron binary downloads are blocked, use mirrors:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install --registry=https://registry.npmmirror.com
```

## Development

```bash
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm test
```

Run a single test file:

```bash
npx vitest run src/renderer/src/composables/useTodos.test.ts
```

## Build

```bash
npm run build
```

Preview the built app:

```bash
npm run preview
```

## Structure

- `src/main/` — Electron main process
- `src/preload/` — isolated preload bridge exposed to the renderer
- `src/renderer/` — Vue renderer app
- `docs/` — durable project documentation and decisions
