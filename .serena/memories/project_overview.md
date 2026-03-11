# git-clean-up overview

- Purpose: TypeScript CLI for cleaning local git repositories, currently focused on identifying and deleting local branches that are merged, gone, or squash-merged.
- Stack: Node.js, TypeScript, Commander for CLI parsing, Clack for prompts/spinners, Execa for git subprocesses, Vitest for tests, Biome + markdownlint + tsc for checks.
- Structure: `src/index.ts` orchestrates CLI flow, `src/cli.ts` defines options, `src/git.service.ts` wraps git queries, `src/ui.ts` contains prompt/output helpers, `src/branch-protection.ts` defines protected branches, `src/__test__` contains unit and e2e tests.
- Current product shape: interactive cleanup flow with dry-run and all-selection modes; safe defaults exclude protected branches, current branch, and branches used by other worktrees.
