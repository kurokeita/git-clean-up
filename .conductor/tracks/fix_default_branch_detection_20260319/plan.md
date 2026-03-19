# Implementation Plan: Automatic Default Branch Detection

## Phase 1: Preparation and Failing Tests

- [ ] Task: Create unit tests for `GitService.getDefaultBranch`.
  - [ ] [Sub-task]: Add test file `src/__test__/git.service.default-branch.test.ts`.
  - [ ] [Sub-task]: Mock various git repository states (no remote, main exists, only master exists).
  - [ ] [Sub-task]: Assert that `getDefaultBranch` returns the expected branch name.
- [ ] Task: Manual Verification — 'Phase 1 Preparation'

## Phase 2: Implementation

- [ ] Task: Implement `getDefaultBranch` in `GitService`.
  - [ ] [Sub-task]: Use `git symbolic-ref refs/remotes/origin/HEAD` as the primary indicator.
  - [ ] [Sub-task]: Fall back to checking existence of `main`, then `master`.
  - [ ] [Sub-task]: Return the current branch if all others are missing.
- [ ] Task: Update CLI to use detected default branch.
  - [ ] [Sub-task]: Update `runApp` in `src/index.ts` to call `getDefaultBranch` if no target is specified.
- [ ] Task: Manual Verification — 'Phase 2 Implementation'

## Phase 3: Verification and Finalization

- [ ] Task: Run all tests and ensure they pass.
  - [ ] [Sub-task]: `pnpm test`
- [ ] Task: Manual Verification — 'Phase 3 Verification'
