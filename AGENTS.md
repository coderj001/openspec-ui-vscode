# Openspec-UI - VSCode Extension

VSCode extension for managing openspec, and enhance view experience of openspec.

Tech stack: TypeScript & VSCode Extension API

## Project Purpose

1. To provide Openspec markdown file and visual appeling interface
2. To show list of spec currently have, and to provide dashboard 


## Architecture Overview

### Extension Activation

Entry point: `src/extension.ts`.

## General Coding Guidelines
-   **TypeScript First**: Ensure all new code and refactors are fully typed. Avoid `any`; use `unknown` if a type is truly dynamic.
-   **Imports**: Use standard relative and absolute ES module imports. In the backend, file extensions are omitted or handled via `.js` standard if necessary.
-   **Immutability**: Prefer immutable data structures. Use pure functions where possible.
-   **Error Handling**: Fail fast and gracefully. On the backend, use centralized error handlers. On the frontend, ensure UI does not crash on API exceptions.

## Build and Test

- **Build:** `npm run compile` (runs `tsc` for both main extension and language server)
- **Test:** `npm run test` (compile + Mocha via `@vscode/test-electron`)
- **Test pattern:** `*.test.ts` files co-located with source. TDD-style (`suite`/`test`). Uses Node `assert`.
- **Lint:** `npm run eslint` (ESLint with TypeScript)
- **Schema generation:** `npm run schema:makecomapp` generates JSON schema from TypeScript types
- **Package:** `npm run vsceBuild` / `npm run vscePublish` (with pre-release flag mechanism)
- **CI:** GitHub Actions in `.github/workflows/ci.yaml` - runs tests on Ubuntu with xvfb

## Key Conventions

- Online-mode commands are in `src/commands/` as JS files with static `register()` methods. Local-dev commands are registered in `src/local-development/index.ts`.
- All async command handlers are wrapped with `catchError()` for consistent error display.
- Progress dialogs use `AsyncLocalStorage` pattern - see `src/utils/vscode-progress-dialog.ts`.
- Component code types map between user-friendly names and API names. Definitions in `src/services/component-code-def.ts`.
- File paths for local components follow: `{componentType}s/{localId}/{kebab-id}.{codeType}.{ext}`. Path logic in `src/local-development/local-file-paths.ts`.

## Strictly Forbidden
-   **No WebSockets**: Do not use WebSockets, Socket.io, or any real-time push protocol. All sync must use HTTP polling.
-   **No Databases**: Do not use any database (SQL, NoSQL, SQLite, etc.). All data is stored in-memory only.
-   **No Authentication**: Do not add authentication, sessions, JWT, or OAuth.
-   **No Backend**: Do not add backend & APIs 


## When in Plan Mode
- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Interview user in detail (for Claude: use the AskUserQuestionTool) about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing the user continually until it's complete. Use the answers to create a detailed spec.
- Make assumptions explicit: When you must proceed under uncertainty, list assumptions up front and continue.


## Agent Behavioral guidelines to reduce common LLM coding mistakes
- Don't assume. Don't hide confusion. Surface tradeoffs.
- Minimum code that solves the problem. Nothing speculative.
- Touch only what you must. Clean up only your own mess.
- Define success criteria. Loop until verified.

## Agent Persona
-   Be extremely concise. Sacrifice grammar for the sake of concision.
-   Do not output large blocks of code if a small change suffices.
-   When creating or editing files, ensure consistency with the existing directory structure detailed above.

## Git commit rules
- Keep commits granular and meaningful
- start with "feat:", "fix:", "docs:", "style:", "refactor:", "test:", "chore:"
