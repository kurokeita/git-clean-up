# Specification: Fix Stash Cleanup Index Shifting

## Overview

When cleaning up multiple stashes, each `git stash drop` operation shifts the indices of the remaining stashes in the stash list. If multiple stashes are selected for deletion, the current sequential execution of drop commands will either skip some stashes (because they now have different indices) or fail (because it's targeting a non-existent index).

## Type

Bug

## Functional Requirements

- [FR-1]: Correctly delete all selected stashes, regardless of their original indices.
- [FR-2]: Ensure that each `git stash drop` operation targets the correct stash.

## Acceptance Criteria

- [ ] [Criterion 1]: Selecting multiple stashes for cleanup correctly removes all selected stashes.
- [ ] [Criterion 2]: Stashes that are NOT selected remain unaffected.
- [ ] [Criterion 3]: No errors are thrown when multiple stashes are deleted.

## Out of Scope

- [OOS-1]: Redesigning the stash finding logic.
- [OOS-2]: Adding new stash cleanup types.

## Dependencies
