# src/ — Source Code

## Directory Purpose

Core application source code. All TypeScript modules that implement the git-clean-up CLI.

## File Structure

| File | Purpose |
|------|---------|
| `index.ts` | Application entry point and orchestrator (`runApp()`) |
| `cli.ts` | CLI argument parsing with `commander` |
| `config.ts` | Configuration loading, validation, global/local merge, config initialization, and watch/reload helpers |
| `git.service.ts` | Git operations service — all git CLI invocations via `execa` |
| `ui.ts` | User interface layer — `@clack/prompts` wrappers |
| `cleanup-executor.ts` | Executes cleanup actions |
| `cleanup.types.ts` | Core domain types and interfaces |
| `branch-protection.ts` | Branch protection patterns and matching |
| `version.ts` | Version management and npm update checking |

## Key Types

See `cleanup.types.ts` for all domain types:

- `CleanupCategory` — "branch" | "stash" | "worktree"
- `CleanupRisk` — "low" | "medium" | "high"
- `CleanupFinding` — A detected issue with action metadata
- `CleanupAction` — An executable git operation
- `ScanOptions` — Parameters for scanning
- `CleanupPolicy` / `ResolvedCleanupPolicy` — User config shapes

## Data Flow

```
cli.ts → ParsedCommand
    ↓
config.ts → ResolvedCleanupPolicy (defaults <- global <- local)
    ↓
git.service.ts → CleanupFinding[]
    ↓
cleanup-executor.ts → execute actions
```

## Conventions

- **Classes**: PascalCase, single responsibility (`GitService`, `CleanupExecutor`)
- **Functions**: camelCase, verb-first (`getBranchFindings`, `pruneRemotes`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PROTECTED_BRANCHES`, `CONFIG_SCHEMA_URL`)
- **Error handling**: graceful fallbacks for git ops, structured exit codes
- **No side effects** in modules — all behavior through exported functions/classes
- **Startup config UX**: interactive `scan` may create missing config files or repair an invalid `defaultTargetBranch`; `$schema` is ignored at runtime, accepted by the parser, and written as the canonical `CONFIG_SCHEMA_URL` on init.

## New in This Branch

- `git-worktree-inspector.ts` — deep inspection for dirty/unpushed worktrees, detached HEAD safety checks
- **CI/policy mode** — new CLI flags: `--fail-on`, `--max-findings`, `--summary`
- **Layered config** — supports global (`~/.git-clean-up.json`) and repo-local (`.git-clean-up.json`) configs with proper precedence
- **Interactive config repair** — prompts user to fix invalid `defaultTargetBranch` during `scan`
