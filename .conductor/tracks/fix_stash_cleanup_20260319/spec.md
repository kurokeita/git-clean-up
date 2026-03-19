# Specification: Fix Interactive Stash Cleanup Execution

## Overview

The interactive `git-clean-up` flow currently allows the user to review stash findings, select all stash entries, confirm cleanup, and shows "Cleanup actions applied". However, after the flow completes, the selected stashes are still present in `git stash list`.

This track fixes the runtime stash cleanup path used by the terminal UI so that applying selected stash actions actually removes the intended stash entries.

## Type

Bug

## Functional Requirements

- [FR-1]: Applying stash cleanup actions from the interactive terminal UI must remove the selected stash entries from the repository.
- [FR-2]: When multiple stash entries are selected, every selected stash must be deleted.
- [FR-3]: Stash entries that were not selected must remain intact.
- [FR-4]: The post-cleanup interactive flow must reflect the updated repository state instead of continuing to show the same stash findings.

## Non-Functional Requirements

- [NFR-1]: The fix must preserve the existing interactive UX and confirmation flow.
- [NFR-2]: The implementation must be covered by automated tests for both execution logic and an end-to-end interactive cleanup path.

## Acceptance Criteria

- [ ] [Criterion 1]: In the interactive stash category flow, selecting all listed stashes and confirming cleanup removes those stashes from `git stash list`.
- [ ] [Criterion 2]: The cleanup step does not falsely report success when no stash was actually removed.
- [ ] [Criterion 3]: After cleanup, the follow-up scan no longer shows the deleted stash findings.
- [ ] [Criterion 4]: Non-selected stashes remain present after cleanup.

## Out of Scope

- [OOS-1]: Redesigning stash finding criteria such as age thresholds or duplicate detection.
- [OOS-2]: Changing non-stash cleanup categories or the broader interactive layout.
- [OOS-3]: Adding new stash cleanup commands beyond deleting selected stash entries.

## Dependencies

- [DEP-1]: Access to `git stash list` and `git stash drop`.
- [DEP-2]: Existing interactive UI flow built with `@clack/prompts`.
