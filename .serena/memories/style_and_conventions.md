# Style and conventions

- TypeScript ESM project with tabs for indentation and double quotes.
- Small focused modules: CLI parsing, UI helpers, git service, branch protection.
- Prefer async methods around git subprocess calls using Execa.
- Tests use Vitest with straightforward describe/it organization and light mocking of `execa`.
- User-facing behavior emphasizes safe cleanup and explicit confirmation before deletion.
