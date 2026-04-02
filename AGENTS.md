# git-clean-up — Agent Context

## Project Overview

Interactive CLI tool to clean up local git branches, stashes, and worktrees. Published as `@kurokeita/git-clean-up` on npm.

**Core philosophy**: Never mutate without consent. Default `clean` mode is a dry-run preview; `--apply` must be explicitly passed.

## Tech Stack

- **Runtime**: Node.js 18+ (ESM)
- **Language**: TypeScript (strict mode)
- **Build**: tsup (ESM + DTS)
- **Test**: Vitest (unit + e2e)
- **Lint/Format**: Biome
- **Package Manager**: pnpm

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@clack/prompts` | Interactive CLI prompts |
| `commander` | CLI argument parsing |
| `execa` | Child process execution (git commands) |
| `picocolors` | Terminal colors |

Zero runtime dependencies beyond these four.

## Architecture

```
User runs: git-clean-up [mode] [options]
    ↓
[index.ts] runApp() — orchestrator
    ↓
[cli.ts] parse args → ParsedCommand
    ↓
[config.ts] resolve policy (defaults <- global <- local; CLI overrides in index.ts)
    ↓
[git.service.ts] collectFindings() — parallel scan
    ↓
[cleanup-executor.ts] run(findings) — execute actions
```

## CLI Modes

| Mode | Purpose |
|------|---------|
| `scan` | Interactive scan — select categories, review findings, execute actions |
| `clean` | Non-interactive clean — preview or `--apply` |
| `init` | Reserved/not currently implemented as a standalone command |

## Key Conventions

- **Formatting**: tabs, double quotes, semicolons as-needed (Biome)
- **Naming**: PascalCase classes, camelCase functions, UPPER_SNAKE_CASE constants
- **Error handling**: graceful fallbacks for git ops, structured exit codes (0=success, 1=policy, 2=usage, 3=runtime)
- **Testing**: Vitest, mock `execa` for GitService, mock `@clack/prompts` for UI, e2e with real git repos
- **Tests co-located**: `src/__test__/`

## Config

- Local: `.git-clean-up.json` (CWD or repo root)
- Global: `~/.git-clean-up.json`
- Precedence: CLI args > local config > global config > built-in defaults
- `CONFIG_SCHEMA_URL` (`https://github.com/kurokeita/git-clean-up/config-schema.json`)
  is the canonical `$schema` reference written by the init flow; ignored at runtime.
- Interactive `scan` startup may offer config creation/repair flows
- History: `.git-clean-up/history/` (inside repo)

## Scripts

```bash
pnpm dev          # Run with tsx
pnpm build        # Build with tsup
pnpm test         # Run vitest
pnpm lint         # Biome check
pnpm format       # Biome format + markdownlint
pnpm check        # lint + markdownlint + tsc --noEmit
```

## Subdirectories

- [src/](src/AGENTS.md) — Source code structure
- [src/\_\_test\_\_/](src/__test__/AGENTS.md) — Test files
