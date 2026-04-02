# src/__test__/ — Tests

## Directory Purpose

All test files for the git-clean-up project. Co-located with source in `src/__test__/`.

## Test Files

| File | What It Tests | Approach |
|------|---------------|----------|
| `index.test.ts` | `runApp()` orchestrator | Extensive mocking of all dependencies; covers all modes, config priority, target branch repair |
| `cli.test.ts` | CLI argument parsing | Tests all modes and option combinations |
| `config.test.ts` | Config loading/validation | Defaults, merging, rejection of invalid keys, template rendering |
| `git.service.test.ts` | GitService operations | Mocks `execa`; tests branch/stash/worktree finding detection |
| `git.service.default-branch.test.ts` | `getDefaultBranch()` fallback chain | origin HEAD → local main → local master → current branch |
| `ui.test.ts` | UI helpers | Grouping findings, formatting labels, serialization, prompts |
| `cleanup-executor.test.ts` | Action executor | Deduplication, dry-run preview, stash sort order |
| `branch-protection.test.ts` | Branch protection patterns | Default protected branches, case-insensitivity, wildcards |
| `e2e.test.ts` | End-to-end | Real git repo; builds project first, tests full CLI flows |

## Testing Conventions

- __Runner__: Vitest
- __Mocking__: `vi.hoisted()` for mock declarations, `vi.mock()` for modules
- __GitService tests__: mock `execa` with `vi.fn()` returning structured results
- __UI tests__: mock `@clack/prompts` functions
- __Index tests__: mock all dependencies (CLI, config, GitService, UI, executor)
- __E2E tests__: `mkdtemp` for temp repos, real git operations, built CLI via `node dist/index.js`
- __Cleanup__: `afterEach` or `finally` blocks with `rm -rf` on temp directories

## Key Patterns

- Factory function: `finding()` to create test `CleanupFinding` objects
- Helper: `mockResult()` to create execa-compatible mock results
- Tests use `describe`/`it`/`expect` structure
- Async tests with `async/await`
