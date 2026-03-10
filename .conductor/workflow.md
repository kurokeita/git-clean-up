# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** Aim for >80% code coverage for all modules
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.
7. **Always Format:** Always run `pnpm format` after generating anything (code and even conductor plan alike).

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file for the feature or bug fix.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run the test suite again and confirm that all tests now pass. This is the "Green" phase.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Verify Coverage:** Run coverage reports using the project's chosen tools. Target: >80% coverage for new code.

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes:**
   - Stage all code changes related to the task.
   - Propose a clear, concise commit message (e.g., `feat(ui): Create basic HTML structure for calculator`).
   - Perform the commit.

9. **Attach Task Summary with Git Notes:**
   - **Step 9.1: Get Commit Hash:** Obtain the hash of the *just-completed commit* (`git log -1 --format="%H"`).
   - **Step 9.2: Draft Note Content:** Create a detailed summary for the completed task. Include the task name, a summary of changes, a list of all created/modified files, and the core "why" for the change.
   - **Step 9.3: Attach Note:** Use the `git notes` command to attach the summary to the commit.

     ```bash
     git notes add -m "<note content>" <commit_hash>
     ```

10. **Get and Record Task Commit SHA:**
    - **Step 10.1: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the first 7 characters of the commit hash.
    - **Step 10.2: Write Plan:** Write the updated content back to `plan.md`.

11. **Commit Plan Update:**
    - Stage the modified `plan.md` file.
    - Commit with a message like `conductor(plan): Mark task 'Create user model' as complete`.

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** Executed immediately after a task is completed that also concludes a phase in `plan.md`.

1. **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2. **Ensure Test Coverage for Phase Changes:**
   - **Step 2.1: Determine Phase Scope:** Find the starting point by reading `plan.md` for the previous phase's checkpoint SHA. If none exists, scope is all changes since the first commit.
   - **Step 2.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD`.
   - **Step 2.3: Verify and Create Tests:** For each code file in the list, verify a corresponding test file exists. If missing, create one that validates the functionality described in this phase's tasks.

3. **Execute Automated Tests with Proactive Debugging:**
   - Announce the exact shell command before running (e.g., `CI=true pnpm test`).
   - Execute the command. If tests fail, attempt to fix a **maximum of two times**. If still failing after two attempts, stop and ask the user for guidance.

4. **Propose a Detailed, Actionable Manual Verification Plan:**
   - Analyze `product.md`, `product-guidelines.md`, and `plan.md` to determine the user-facing goals of the completed phase.
   - Generate step-by-step verification instructions with commands and expected outcomes.

5. **Await Explicit User Feedback:**
   - Ask the user: "Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed."
   - **PAUSE** and await the user's response. Do not proceed without an explicit confirmation.

6. **Create Checkpoint Commit:**
   - Stage all changes. If no changes occurred, use an empty commit.
   - Commit with a message like `conductor(checkpoint): Checkpoint end of Phase X`.

7. **Attach Auditable Verification Report using Git Notes:**
   - Draft a verification report including the automated test command, the manual verification steps, and the user's confirmation.
   - Attach the report to the checkpoint commit using `git notes`.

8. **Get and Record Phase Checkpoint SHA:**
   - **Step 8.1: Get Commit Hash:** `git log -1 --format="%H"`
   - **Step 8.2: Update Plan:** Find the completed phase heading in `plan.md` and append the first 7 characters: `[checkpoint: <sha>]`.
   - **Step 8.3: Write Plan:** Write the updated content back to `plan.md`.

9. **Commit Plan Update:**
   - Stage the modified `plan.md`.
   - Commit with a message like `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

10. **Announce Completion:** Inform the user that the phase checkpoint has been created.

### Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass
- [ ] Code coverage meets requirements (>80%)
- [ ] Code follows project's code style guidelines
- [ ] All public functions/methods are documented (e.g., docstrings, JSDoc)
- [ ] Type safety is enforced (TypeScript types)
- [ ] No linting or static analysis errors (using \`pnpm run lint\`)
- [ ] Documentation updated if needed
- [ ] No security vulnerabilities introduced

## Development Commands

### Setup

```bash
pnpm install
```

### Daily Development

```bash
# Start dev server / watcher
pnpm run dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Format code
pnpm run format

# Type check
pnpm exec tsc --noEmit
```

### Before Committing

```bash
# Run all checks
pnpm run check
```

## Testing Requirements

### Unit Testing

- Every module must have corresponding tests using Vitest.
- Use appropriate test setup/teardown mechanisms (\`beforeEach\`, \`afterEach\`).
- Mock external dependencies (especially git operations).
- Test both success and failure cases.

### Integration Testing

- Test complete CLI flows using \`execa\` or mocked \`commander\` setups.
- Verify branch deletion logic against a temporary git repository.
- Test interactive prompts by mocking \`@clack/prompts\`.

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks
- `conductor(plan)`: Track planning updates
- `conductor(checkpoint)`: Phase checkpoint commits
- `conductor(setup)`: Project context initialization

### Examples

```bash
git commit -m "feat(cli): Add interactive branch selection"
git commit -m "fix(git): Correct remote branch detection logic"
git commit -m "conductor(plan): Mark task 'Setup vitest' as complete"
```

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing
3. Code coverage meets project requirements (>80%)
4. Documentation complete (if applicable)
5. Code passes all configured linting and static analysis checks
6. Implementation notes added to `plan.md`
7. Changes committed with proper message
8. Git note with task summary attached to the commit
