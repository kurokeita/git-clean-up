# Implementation Plan: Fix Stash Cleanup Index Shifting

## Phase 1: Preparation and Failing Tests

- [x] Task: Create a failing unit test for `CleanupExecutor.run` with multiple stashes 9a53a33
  - [x] [Sub-task]: Add a test case to `src/__test__/cleanup-executor.test.ts`
  - [x] [Sub-task]: Mock `execa` and capture the arguments of all calls
  - [x] [Sub-task]: Assert that `git stash drop stash@{n}` calls are in descending order of `n`
- [x] Task: Manual Verification — 'Phase 1 Preparation'

## Phase 2: Implementation

- [x] Task: Update `CleanupExecutor` to sort stash cleanup actions 9a53a33
  - [x] [Sub-task]: Add a sorting step in `run` and `previewCommands` specifically for `drop-stash` actions
  - [x] [Sub-task]: Implement a helper method to extract the stash index for sorting
- [x] Task: Manual Verification — 'Phase 2 Implementation'

## Phase 3: Verification and Finalization

- [x] Task: Run all tests and ensure they pass 50a70c3
  - [x] [Sub-task]: `pnpm test`
- [x] Task: Verify with a real git repository 50a70c3
  - [x] [Sub-task]: Use the reproduction script to manually confirm it works now.
- [x] Task: Manual Verification — 'Phase 3 Verification'
