# Specification: Initial Project Setup and Core CLI Implementation

## Overview

This track covers the foundational setup of the \`git-clean-up\` project and the implementation of its core functionality as an interactive CLI tool. This includes environment configuration, toolchain setup (Biome, Markdownlint), and the development of the primary features: branch discovery, interactive selection, and safe deletion.

## Type

Feature

## Functional Requirements

- [FR-1]: **Project Initialization**: Setup \`package.json\`, TypeScript, Biome, and Markdownlint.

- [FR-2]: **Branch Discovery**: Detect local branches that are merged or "gone" (remote deleted).

- [FR-3]: **Interactive UI**: Implement a selection menu using \`@clack/prompts\` to choose branches for deletion.

- [FR-4]: **Safe Deletion**: Protect default branches (\`main\`, \`master\`) and perform deletions only after confirmation.

- [FR-5]: **Dry Run**: Support a \`--dry-run\` flag to preview deletions without affecting the repository.

## Acceptance Criteria

- [ ] \`pnpm run check\` runs Biome and Markdownlint with zero errors.

- [ ] CLI correctly identifies merged and "gone" branches in a real git repository.

- [ ] Interactive UI displays branches with status indicators (e.g., [Merged], [Gone]).

- [ ] Protected branches are excluded from the selection list or explicitly marked as non-deletable.

- [ ] Automated tests cover branch detection and CLI command parsing with >80% coverage.

## Out of Scope

- Advanced branch filtering (e.g., by date or author) - to be handled in a future track.

- Custom configuration files for \`git-clean-up\` behavior.

## Dependencies

- Node.js, pnpm, git.

- Libraries: \`commander\`, \`@clack/prompts\`, \`picocolors\`, \`simple-git\`, \`execa\`, \`vitest\`, \`tsup\`.
