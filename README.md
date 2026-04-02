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
- **Repo-Local Policy Config**:
  - `git-clean-up` loads optional repo-local policy from `.git-clean-up.json`.
  - CLI flags override repo config, and repo config overrides built-in defaults.

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

You can customize cleanup defaults per repository with a `.git-clean-up.json`
file placed at the repository root:

```json
{
  "protectedBranches": ["release/*", "hotfix/*"],
  "includeCategories": ["branch", "worktree"],
  "stashAgeDays": 21,
  "branchInactiveDays": 90,
  "divergedAheadCount": 8,
  "divergedBehindCount": 8,
  "branchExcludePatterns": ["wip/*"]
}
```

Supported keys:

- `protectedBranches`: additional exact names or `*` wildcard patterns that
  should never be treated as cleanup candidates
- `includeCategories`: default categories to scan (`branch`, `stash`,
  `worktree`)
- `stashAgeDays`: default stash age threshold
- `branchInactiveDays`: reserved for upcoming inactive-branch detection
- `divergedAheadCount`: default ahead threshold for long-diverged branches
- `divergedBehindCount`: default behind threshold for long-diverged branches
- `branchExcludePatterns`: branch patterns to exclude from branch cleanup

Rules:

- CLI flags take precedence over `.git-clean-up.json`
- `.git-clean-up.json` extends built-in defaults for protected branches
- Invalid config fails closed with a user-facing error

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
