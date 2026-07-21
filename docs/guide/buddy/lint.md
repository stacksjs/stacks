---
title: Buddy lint command
description: Check and fix project style through Buddy's Pickier integration.
---

# Lint command

`buddy lint` checks the project with Pickier. It covers TypeScript, STX, Markdown, JSON, YAML, and repository configuration.

## Usage

```bash
buddy lint
buddy lint --fix
buddy lint:fix
```

`--fix` applies safe formatting and rule fixes. Review the diff before committing because formatting can expose invalid examples or malformed Markdown that require a source correction.

## Check formatting only

```bash
buddy format:check
```

Use `buddy format` to apply formatting without changing the lint command used by CI.

## Configuration

Project rules live in `config/code-style.ts`. Standalone packages may use `.config/pickier.ts` and pass it through their package script:

```json
{
  "scripts": {
    "lint": "bunx --bun pickier . --config .config/pickier.ts",
    "lint:fix": "bunx --bun pickier . --config .config/pickier.ts --fix"
  }
}
```

Stacks does not use a separate UI-runtime or ESLint configuration. STX markup and scripts are checked through the project Pickier setup.

## CI example

```yaml
- run: bun install --frozen-lockfile
- run: buddy lint
- run: buddy test:types
- run: buddy test
```

## See also

- [Linting and formatting](/guide/linting)
- [Testing](/guide/buddy/test)
