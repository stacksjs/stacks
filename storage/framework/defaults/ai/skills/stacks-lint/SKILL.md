---
name: stacks-lint
description: Use when linting or formatting a Stacks project. Always use Pickier through buddy or its native CLI, never ESLint directly.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
---

# Stacks Linting

Use `./buddy lint`, `./buddy lint:fix` and `./buddy format`. The code-style
commands call Pickier's SDK directly. Pickier is the linter and formatter;
it does not wrap ESLint. ESLint-style disable comments are compatibility syntax.

## Commands

- `./buddy lint`: report errors and warnings; errors fail the command.
- `./buddy lint --max-warnings 0`: require zero errors and warnings.
- `./buddy lint:fix --max-warnings 0`: fix supported findings and enforce the warning budget.
- `./buddy format`: write formatting; `./buddy format --check` checks without writing.
- `./buddy lint --stx`: run the separate stx conformance checks from `config/lint.ts`.

For direct CLI use, run `bunx --bun pickier .`, adding `--fix` for supported
fixes. Re-run without `--fix` to confirm remaining findings. Only apply fixes
that preserve the source behavior; investigate false positives at Pickier's source.

## Configuration and discovery

Pickier discovers its own configuration (`pickier.config.ts`, `.config/pickier.ts`,
and other supported names). `config/code-style.ts` is the framework's policy;
applications may supply their own Pickier config. An explicit CLI `--config`
selects that file. Keep the command and CI on the same policy.

Buddy discovers tracked files plus untracked files allowed by `.gitignore`.
Its extension and path predicate lives in `@stacksjs/actions/lint/files`;
code-style discovery currently includes ts, js, json, md, yaml and yml.
Use Pickier directly to include stx and shell sources. Generated framework
assets belong to the upstream framework's checks, not application edits.

## Conventions

Use two spaces, single quotes and no optional semicolons. Use Crosswind classes
and stx signals/directives in templates. Fix real findings in source, rather than
turning off rules to obtain a clean report. For intentional unused variables,
prefer a targeted `// eslint-disable-next-line` over an underscore prefix.

## Source

- Actions: `storage/framework/core/actions/src/lint/lint.ts`
- CLI: `storage/framework/core/buddy/src/commands/lint.ts`
- Discovery: `storage/framework/core/actions/src/lint/files.ts`
- Formatter/linter: the first-party Pickier repository
