# Specification: Automatic Default Branch Detection

## Overview

The CLI tool currently defaults to `main` as the target branch for comparison. If `main` does not exist locally, many git operations (like `git branch --merged main`) fail with exit code 128. The tool should automatically detect the repository's default branch (usually `main` or `master`) and use that as the default target.

## Type

Bug

## Functional Requirements

- [FR-1]: Automatically detect the default branch of the local repository.
- [FR-2]: Use the detected default branch as the target for branch comparison if none is specified by the user.
- [FR-3]: Gracefully handle cases where the detected branch or the hardcoded "main" fallback does not exist.

## Acceptance Criteria

- [ ] [Criterion 1]: Tool does not crash if `main` is missing but `master` (or another default) is present.
- [ ] [Criterion 2]: Detection correctly identifies `main`, `master`, or follows the remote's HEAD reference.
- [ ] [Criterion 3]: Users can still override the target branch using the `--target` flag.

## Out of Scope

- [OOS-1]: Supporting multiple target branches simultaneously.
- [OOS-2]: Changing the protected branch list based on detection (protected branches should remain a static list for safety).

## Dependencies

- [DEP-1]: Access to `git` command.
