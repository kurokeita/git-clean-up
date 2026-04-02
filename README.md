# git-clean-up 🧹

An audit-first CLI tool for cleaning local git repository hygiene. It scans for stale branches, forgotten stashes, and suspicious worktrees, then lets you selectively clean them with explicit confirmation.

## Features

- **Audit-First Workflow**: `scan` inspects repository hygiene without mutating anything, and `clean` previews changes unless `--apply` is explicitly set.
- **Grouped Findings**: Results are organized by branches, stashes, and worktrees with per-item reasons and risk hints.
- **Branch Hygiene Detection**:
  - merged branches
  - branches whose upstream is gone
  - branches with no upstream
  - significantly diverged branches
  - squash-merged branches
- **Stash Hygiene Detection**:
  - old stashes
  - stale WIP stashes
  - duplicate-message stashes
- **Worktree Hygiene Detection**:
  - missing-path worktrees
  - detached-head worktrees
  - protected-branch worktrees
  - worktrees pointing at stale branches
- **Safety First**:
  - Protected branches (`main`, `master`, `develop`, `dev`) are not surfaced as branch cleanup candidates.
  - Branches active in other worktrees are excluded from branch deletion candidates.
  - `clean` is a preview by default.
  - Explicit confirmation is required before applying cleanup actions unless `--all` is used.
- **Layered Policy Config**:
  - `git-clean-up` can load a global config from `~/.git-clean-up.json` and a repo-local config from `.git-clean-up.json`.
  - CLI flags override local config, local config overrides global config, and global config overrides built-in defaults.
  - Interactive `scan` startup can help create missing config files and repair an invalid configured `defaultTargetBranch`.

## Installation

You can run it directly without installation:

```bash
pnpx @kurokeita/git-clean-up
```

Or install it globally to your system:

```bash
pnpm install -g @kurokeita/git-clean-up
```

## Usage

```bash
# Start an interactive repository scan
git-clean-up

# Audit all hygiene categories and return JSON
git-clean-up scan --json

# Focus on branch and worktree findings only
git-clean-up scan --include branches,worktrees

# Preview cleanup actions without mutating the repo
git-clean-up clean --include branches --all

# Apply the selected cleanup actions
git-clean-up clean --include branches,stashes --apply

# Use a different merge target and age threshold
git-clean-up scan --target develop --age-days 14
```

## Configuration

You can customize cleanup defaults with:

- a global config at `~/.git-clean-up.json`
- an optional repo-local config at `.git-clean-up.json`

When both exist, the repo-local config overrides the global config.

Example config:

```json
{
  "$schema": "https://github.com/kurokeita/git-clean-up/config-schema.json",
  "protectedBranches": ["release/*", "hotfix/*"],
  "includeCategories": ["branch", "worktree"],
  "stashAgeDays": 21,
  "defaultTargetBranch": "origin/main",
  "branchInactiveDays": 90,
  "divergedAheadCount": 8,
  "divergedBehindCount": 8,
  "branchExcludePatterns": ["wip/*"]
}
```

Supported keys:

- `$schema`: optional JSON Schema reference for IDE validation and autocomplete
- `protectedBranches`: additional exact names or `*` wildcard patterns that
  should never be treated as cleanup candidates
- `includeCategories`: default categories to scan (`branch`, `stash`,
  `worktree`)
- `stashAgeDays`: default stash age threshold
- `defaultTargetBranch`: default branch/ref to compare against when `--target` is not provided
- `branchInactiveDays`: threshold used for inactive-branch detection
- `divergedAheadCount`: default ahead threshold for long-diverged branches
- `divergedBehindCount`: default behind threshold for long-diverged branches
- `branchExcludePatterns`: branch patterns to exclude from branch cleanup

Rules:

- CLI flags take precedence over repo-local config
- Repo-local config takes precedence over global config
- Global config takes precedence over built-in defaults
- Protected branches extend built-in defaults instead of replacing them

### Interactive config help

During interactive `scan` startup only:

- If no config files exist, `git-clean-up` can offer to create a global config.
- If only a global config exists, `git-clean-up` can offer to keep using it or create a local config for the repo.
- If `defaultTargetBranch` is configured but invalid, `git-clean-up` can:
  - replace it with the detected default branch, or
  - wait for you to edit the config file and retry until the configured value becomes valid.
- When `git-clean-up` creates a config file for you, it automatically sets
  `$schema` to `https://github.com/kurokeita/git-clean-up/config-schema.json`.

A JSON Schema for `.git-clean-up.json` is available at
[`config-schema.json`](config-schema.json).
You can add the canonical `$schema` reference for editor validation and autocomplete:

```json
"$schema": "https://github.com/kurokeita/git-clean-up/config-schema.json"
```

The `$schema` key is ignored by `git-clean-up` at runtime.

## Development

```bash
pnpm install
pnpm dev          # Run in development mode
pnpm test         # Run tests
pnpm run check    # Run linting and type checking
pnpm run build    # Build for production
```

## License

GPL-3.0
