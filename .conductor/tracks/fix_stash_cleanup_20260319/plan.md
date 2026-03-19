# Implementation Plan: Fix Interactive Stash Cleanup Execution

## Phase 1: Preparation and Failing Tests

- [ ] Task: Add a failing integration test for interactive stash cleanup.
  - [ ] [Sub-task]: Extend `src/__test__/e2e.test.ts` or add a dedicated interactive cleanup test file.
  - [ ] [Sub-task]: Create a temporary git repository with multiple stash entries.
  - [ ] [Sub-task]: Exercise the cleanup path that applies stash deletions and assert that `git stash list` shrinks afterward.
- [ ] Task: Add a failing unit test for stash cleanup action execution.
  - [ ] [Sub-task]: Inspect `CleanupExecutor` stash action handling in `src/__test__/cleanup-executor.test.ts`.
  - [ ] [Sub-task]: Assert that the exact selected stash references are passed to `git stash drop`.
  - [ ] [Sub-task]: Cover the case where selected stashes are reported as applied but remain present.
- [ ] Task: Manual Verification — 'Phase 1 Preparation'

## Phase 2: Implementation

- [ ] Task: Fix stash cleanup execution in the runtime action path.
  - [ ] [Sub-task]: Trace how selected stash findings are converted into cleanup actions during interactive execution.
  - [ ] [Sub-task]: Correct the stash target passed to `git stash drop` or the ordering/state handling if it is mutating incorrectly at runtime.
  - [ ] [Sub-task]: Ensure the executor reports failure when a stash drop does not actually succeed.
- [ ] Task: Refresh interactive results after stash cleanup.
  - [ ] [Sub-task]: Verify the scan loop re-reads repository state after applying stash cleanup actions.
  - [ ] [Sub-task]: Prevent already-deleted stash findings from being shown again in the next review step.
- [ ] Task: Manual Verification — 'Phase 2 Implementation'

## Phase 3: Verification and Finalization

- [ ] Task: Run all tests and ensure they pass.
  - [ ] [Sub-task]: `CI=true pnpm test`
  - [ ] [Sub-task]: `pnpm run lint`
  - [ ] [Sub-task]: `pnpm exec tsc --noEmit`
- [ ] Task: Verify with the interactive terminal UI in a real git repository.
  - [ ] [Sub-task]: Reproduce the stash-only interactive flow shown in the screenshot.
  - [ ] [Sub-task]: Confirm selected stashes are gone from `git stash list` after applying cleanup.
  - [ ] [Sub-task]: Confirm the follow-up screen no longer reports the deleted stash findings.
- [ ] Task: Manual Verification — 'Phase 3 Verification'
