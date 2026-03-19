# Implementation Plan: Initial Project Setup and Core CLI Implementation

## Phase 1: Environment and Tooling [checkpoint: c1e5cf6]

- [x] Task: Initialize Project Structure 0ead1ec
  - [ ] Initialize \`package.json\` with metadata and scripts.
  - [ ] Install dev dependencies: \`typescript\`, \`tsup\`, \`vitest\`, \`@biomejs/biome\`, \`markdownlint-cli\`.
  - [ ] Configure \`tsconfig.json\` for ESM output.

- [x] Task: Setup Linting and Formatting c61b2cb
  - [ ] Verify existing \`.markdownlint.json\` and \`biome.json\` are respected.
  - [ ] Implement \`pnpm run check\` script.

- [x] Task: Setup Build Pipeline 3971f79
  - [ ] Configure \`tsup.config.ts\` for bundling the CLI.

## Phase 2: Git Core Logic (TDD) [checkpoint: 9fd4f93]

- [x] Task: Implement Branch Detection Logic 469cc48
  - [x] Write tests for identifying merged branches.
  - [x] Write tests for identifying "gone" branches.
  - [ ] Implement \`GitService\` using \`simple-git\` to satisfy tests.

- [x] Task: Implement Branch Protection Logic 5b0570d
  - [ ] Write tests to ensure \`main\`/\`master\` are protected.
  - [x] Implement protection filters.

- [x] Task: Manual Verification — 'Git Core Logic'

## Phase 3: CLI and Interactive UI (TDD) [checkpoint: 404e026]

- [x] Task: Implement Command Parsing 5e24cf5
  - [ ] Write tests for \`commander\` setup and flags (\`--dry-run\`).
  - [x] Implement CLI entry point.

- [x] Task: Implement Interactive Selection 668f86d
  - [x] Write tests/mocks for `@clack/prompts` flow.
  - [x] Implement interactive menu and result reporting.

- [x] Task: Implement Remote Pruning 24f00af
  - [x] Add `--prune` flag to CLI options.
  - [ ] Implement `GitService.pruneRemotes()`.
  - [x] Integrate pruning into the main execution flow.

- [x] Task: Manual Verification — 'CLI and Interactive UI'

## Phase 4: Finalization

- [x] Task: Integration Testing 77cbd7f
  - [ ] Run full E2E tests against a temporary git repo.

- [x] Task: Documentation 473d57e
  - [ ] Create basic \`README.md\` with usage instructions.
