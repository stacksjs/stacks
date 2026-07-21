---
title: STX editor setup
description: Configure an editor for TypeScript, STX templates, Crosswind classes, and Buddy commands.
---

# IDE setup

Stacks source is TypeScript and STX. An editor only needs Bun-aware TypeScript support, HTML-style handling for `.stx` files, and the repository's generated declarations.

## Generate project types

Run the generator after installing the project and whenever components, functions, models, or environment variables change:

```bash
buddy generate
buddy generate:types
```

Generated declarations live under `storage/framework/types/`. Keep that directory in the TypeScript project so browser and server auto-imports resolve correctly.

## Visual Studio Code

The repository ships settings and snippets under `storage/framework/defaults/ide/vscode/`. The important local settings are:

```json
{
  "files.associations": {
    "*.stx": "html"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true
}
```

Use the workspace TypeScript version so the editor and `buddy test:types` evaluate the same compiler configuration.

Recommended extensions:

- EditorConfig
- Bun for Visual Studio Code
- Error Lens
- GitLens

STX template behavior comes from `@stacksjs/stx`, its generated types, and the Bun plugin configured by the project.

## Zed and JetBrains

Associate `*.stx` with HTML for syntax highlighting and keep TypeScript language services enabled for script blocks. Use the repository's `.zed/` or `.idea/` defaults when present, then run `buddy generate:types` so inferred APIs are available.

## Formatting and diagnostics

Buddy delegates linting and formatting to Pickier:

```bash
buddy lint
buddy lint --fix
buddy format:check
buddy test:types
```

Do not configure ESLint or Prettier as a competing formatter. Project rules live in `config/code-style.ts` and `.config/pickier.ts` where present.

## STX conventions

- Put views in `resources/views/` and components in `resources/components/`.
- Use Crosswind utility classes.
- Use signals and composables in `<script>` blocks.
- Do not use direct `window` or `document` access in templates.
- Import standalone APIs from `@stacksjs/stx`; template auto-imports do not need explicit imports.

## Troubleshooting

If completion or types are stale:

```bash
buddy generate:types
buddy doctor
buddy test:types
```

Restart the editor's TypeScript language server after regeneration if it still holds an old declaration graph.
