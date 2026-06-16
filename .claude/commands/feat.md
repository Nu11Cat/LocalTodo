# /project:feat

Implement the feature described in the arguments.

Workflow:

1. Clarify the expected behavior, user-facing changes, and acceptance criteria when the request is ambiguous.
2. Identify whether the change belongs in `src/main`, `src/preload`, or `src/renderer`; keep Node, filesystem, database, and OS integrations behind the preload bridge.
3. Plan non-trivial or multi-file changes before editing.
4. Implement the smallest cohesive feature slice that satisfies the request.
5. Add or update tests for composables and pure utilities when behavior is testable without launching Electron.
6. Run the narrowest meaningful verification first, then broader checks when shared behavior or contracts changed.

Useful commands:

```bash
npm run typecheck
npm test
npx vitest run <test-file>
npm run build
```

Feature request: `$ARGUMENTS`
