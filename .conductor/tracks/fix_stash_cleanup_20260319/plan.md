# Implementation Plan: Fix Interactive Stash Cleanup Execution

## Phase 1: Preparation and Failing Tests [checkpoint: 155274a]

- [x] Task: Add a failing integration test for interactive stash cleanup. bb8f543
  - [x] [Sub-task]: Extend `src/__test__/e2e.test.ts` or add a dedicated interactive cleanup test file.
  - [x] [Sub-task]: Create a temporary git repository with multiple stash entries.
  - [x] [Sub-task]: Exercise the cleanup path that applies stash deletions and assert that `git stash list` shrinks afterward.
- [x] Task: Add a failing unit test for stash cleanup action execution. f762681
  - [x] [Sub-task]: Inspect `CleanupExecutor` stash action handling in `src/__test__/cleanup-executor.test.ts`.
  - [x] [Sub-task]: Assert that the exact selected stash references are passed to `git stash drop`.
  - [x] [Sub-task]: Cover the case where selected stashes are reported as applied but remain present.
- [x] Task: Manual Verification — 'Phase 1 Preparation'

## Phase 2: Implementation

- [x] Task: Fix stash cleanup execution in the runtime action path. bb8f543
  - [x] [Sub-task]: Trace how selected stash findings are converted into cleanup actions during interactive execution.
  - [x] [Sub-task]: Correct the stash target passed to `git stash drop` or the ordering/state handling if it is mutating incorrectly at runtime.
  - [x] [Sub-task]: Ensure the executor reports failure when a stash drop does not actually succeed.
- [x] Task: Refresh interactive results after stash cleanup. be7044e
  - [x] [Sub-task]: Verify the scan loop re-reads repository state after applying stash cleanup actions.
  - [x] [Sub-task]: Prevent already-deleted stash findings from being shown again in the next review step.
- [x] Task: Manual Verification — 'Phase 2 Implementation'

## Phase 3: Verification and Finalization

- [x] Task: Run all tests and ensure they pass.
  - [x] [Sub-task]: `CI=true pnpm test`
  - [x] [Sub-task]: `pnpm run lint`
  - [x] [Sub-task]: `pnpm exec tsc --noEmit`
- [x] Task: Verify with the interactive terminal UI in a real git repository.
  - [x] [Sub-task]: Reproduce the stash-only interactive flow shown in the screenshot.
  - [x] [Sub-task]: Confirm selected stashes are gone from `git stash list` after applying cleanup.
  - [x] [Sub-task]: Confirm the follow-up screen no longer reports the deleted stash findings.
- [x] Task: Manual Verification — 'Phase 3 Verification'
