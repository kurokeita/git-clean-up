# Product Guidelines

## Prose Style

- **Tone**: Professional, helpful, and concise.

- **Voice**: Active and direct (e.g., "Deleting branch..." rather than "The branch is being deleted").

- **Clarity**: Avoid overly technical git jargon in top-level prompts; use descriptive language for actions.

## Branding & Visuals

- **Color Palette**: Use `picocolors` consistently:
  - **Green**: Success and completion.
  - **Red**: Errors and destructive warnings.
  - **Yellow**: Warnings and cautious actions (like "Dry Run").
  - **Blue/Cyan**: Informational headers and labels.
  - **Dim/Gray**: Secondary information or metadata (e.g., branch SHAs).

- **Identity**: Start sessions with a clear header using `@clack/prompts` intro.

## UX Principles

- **Accessibility**: Ensure high-contrast colors are used. Don't rely solely on color to convey meaning (use symbols like ✔, ✘, ⚠).

- **Interactivity**: All user input must go through `@clack/prompts`.

- **Feedback**: Use spinners (`@clack/prompts/spinner`) for all asynchronous git operations (fetching, listing, deleting).

- **Safety First**: Destructive actions (deleting branches) must require explicit confirmation or selection in the interactive UI.

## Error Handling

- **User-Facing**: Errors should be caught and displayed using `@clack/prompts/note` or `cancel` with a clear explanation.

- **Actionable**: Where possible, suggest a fix (e.g., "Run 'git fetch' to synchronize with remote").

- **Debugability**: Suppress stack traces by default, showing them only when a `--verbose` or `--debug` flag is present.
