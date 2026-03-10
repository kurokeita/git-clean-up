# git-clean-up 🧹

A modern, interactive CLI tool to help you keep your local git workspace clean by identifying and removing stale or merged branches.

## Features

- **Interactive Selection**: Choose exactly which branches to delete using a beautiful CLI interface.
- **Automatic Pruning**: Always synchronizes with your remotes (`git fetch --prune`) before scanning.
- **Merged Branch Detection**: Identifies branches already merged into your target branch (e.g., `main`).
- **"Gone" Branch Detection**: Finds local branches whose remote counterparts have been deleted.
- **Squash-Merge Support**: Correctily identifies branches merged via "Squash" strategy (common in GitHub/Azure DevOps PRs).
- **Safety First**:
  - Protected branches (`main`, `master`, `develop`, `dev`) are never listed for deletion.
  - Current branch and branches used in other worktrees are automatically excluded.
  - Explicit confirmation before any deletion.
  - Dry-run mode to preview changes.

## Installation

You can run it directly without installation:

```bash
pnpx git-clean-up
```

Or install it globally to your system:

```bash
pnpm run install:global
```

## Usage

```bash
# Start interactive cleanup
git-clean-up

# Preview which branches would be deleted
git-clean-up --dry-run

# Specify a different target branch for merge detection (default is 'main')
git-clean-up --target develop

# Select all found branches without interaction (useful for scripts)
git-clean-up --all
```

## Development

```bash
pnpm install
pnpm dev          # Run in development mode
pnpm test         # Run tests
pnpm run check    # Run linting and type checking
pnpm run build    # Build for production
```

## License

MIT
