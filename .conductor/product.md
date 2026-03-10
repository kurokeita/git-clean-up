# Product Definition

## Product Overview
`git-clean-up` is a modern, interactive CLI tool designed to help developers maintain a clean local environment by identifying and removing stale or merged git branches. It aims to provide a safe and efficient way to prune local branches that are no longer needed.

## Core Goals
- **Maintainability**: Help developers keep their local git workspace clean by identifying branches that have been merged or whose remotes have been deleted.
- **Safety**: Ensure that critical branches (e.g., `main`, `master`) are never accidentally deleted.
- **Interactivity**: Provide a rich, user-friendly CLI experience for selecting and deleting branches.

## Key Features
- **Interactive Branch Selection**: Use a modern CLI interface to list and select branches for cleanup.
- **Merged Branch Detection**: Identify local branches that have already been merged into the current or a target branch.
- **"Gone" Branch Detection**: Identify local branches that tracked a remote branch that has since been deleted.
- **Dry Run Mode**: Preview changes without actually deleting any branches.
- **Protected Branches**: Support for protecting specific branches from deletion.

## Constraints
- **Runtime**: Node.js (executable via `pnpx git-clean-up`).
- **Language**: TypeScript.
- **CLI Framework**: `commander` for command parsing and `@clack/prompts` with `picocolors` for the interactive UI.
- **Testing**: Comprehensive test suite ensuring reliability in various git states.
