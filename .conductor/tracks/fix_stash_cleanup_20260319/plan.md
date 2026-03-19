# Implementation Plan: Fix Stash Cleanup Index Shifting

## Phase 1: Preparation and Failing Tests

- [x] Task: Create a failing unit test for `CleanupExecutor.run` with multiple stashes 9a53a33
  - [x] [Sub-task]: Add a test case to `src/__test__/cleanup-executor.test.ts`
  - [x] [Sub-task]: Mock `execa` and capture the arguments of all calls
  - [x] [Sub-task]: Assert that `git stash drop stash@{n}` calls are in descending order of `n`
- [ ] Task: Manual Verification — 'Phase 1 Preparation'

## Phase 2: Implementation

- [x] Task: Update `CleanupExecutor` to sort stash cleanup actions 9a53a33
  - [x] [Sub-task]: Add a sorting step in `run` and `previewCommands` specifically for `drop-stash` actions
  - [x] [Sub-task]: Implement a helper method to extract the stash index for sorting
- [ ] Task: Manual Verification — 'Phase 2 Implementation'

## Phase 3: Verification and Finalization

- [ ] Task: Run all tests and ensure they pass.
  - [ ] [Sub-task]: `pnpm test`
- [ ] Task: Verify with a real git repository.
  - [ ] [Sub-task]: Use the reproduction script to manually confirm it works now.
- [ ] Task: Manual Verification — 'Phase 3 Verification'
