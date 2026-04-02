# src/ — Source Code

## Directory Purpose

Core application source code. All TypeScript modules that implement the git-clean-up CLI.

## File Structure

| File | Purpose |
|------|---------|
| `index.ts` | Application entry point and orchestrator (`runApp()`) |
| `cli.ts` | CLI argument parsing with `commander` |
| `config.ts` | Configuration loading, validation, merging with defaults |
| `config-template.ts` | Template generator for `init` command |
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
config.ts → ResolvedCleanupPolicy
    ↓
git.service.ts → CleanupFinding[]
    ↓
cleanup-executor.ts → execute actions
```

## Conventions

- **Classes**: PascalCase, single responsibility (`GitService`, `CleanupExecutor`)
- **Functions**: camelCase, verb-first (`getBranchFindings`, `pruneRemotes`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PROTECTED_BRANCHES`, `EXIT_CODES`)
- **Error handling**: graceful fallbacks for git ops, structured exit codes
- **No side effects** in modules — all behavior through exported functions/classes
