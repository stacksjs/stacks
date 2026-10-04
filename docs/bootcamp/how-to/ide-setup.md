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

Install the [Stacks extension](https://marketplace.visualstudio.com/items?itemName=Stacks.vscode-stacks) (`Stacks.vscode-stacks`). New projects already recommend it in `.vscode/extensions.json`. It is the only extension a Stacks project needs: it installs no others and depends on none.

- **stx templates**: highlighting, completions, hovers, diagnostics, go to definition and utility-class previews for `.stx` files. This is the code of the standalone [stx extension](https://marketplace.visualstudio.com/items?itemName=Stacks.vscode-stx) (`Stacks.vscode-stx`), built in. If you have both installed, the stx extension steps aside.
- **Pickier**: lint diagnostics as you type, Format Document and a `source.fixAll.pickier` fix-all, all from the project's own pickier and `config/code-style.ts`, so the editor agrees with `buddy lint`.
- **Env files**: hover an `encrypted:` value to see it decrypted with the project's keys (it is never written anywhere), keys missing from `.env` compared with `.env.example`, and `buddy env:get`, `env:set`, `env:encrypt`, `env:decrypt` and `env:rotate` from the Command Palette.
- **Stacks: Start Dev Server** runs `./buddy dev` in a `Stacks Dev` terminal. When the server is ready, the app opens in VS Code's built-in Simple Browser.
- **Stacks: Open Preview** opens the running dev server in the Simple Browser, beside your editor. The **Stacks** item in the status bar does the same.
- **Stacks: Run Buddy Command...** lists every command from `./buddy list`, your own `app/Commands/` included, and runs the one you pick. You can also type a command with its arguments, such as `migrate --diff`.

The preview URL is worked out the same way `buddy dev` picks it: `https://<APP_URL>` when the local HTTPS proxy is up, otherwise `http://localhost:<PORT>`. Set `stacks.preview.url` to use a fixed URL instead, or `stacks.preview.preferLocalhost` if the Simple Browser cannot load the local certificate. The [extension README](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ide/vscode) lists every setting.

`buddy setup` copies the workspace settings from `storage/framework/defaults/ide/vscode/.vscode/` into new projects. The important ones are:

```json
{
  "editor.defaultFormatter": "Stacks.vscode-stacks",
  "editor.codeActionsOnSave": {
    "source.fixAll.pickier": "explicit"
  },
  "files.associations": {
    "buddy": "shellscript"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

Do not map `*.stx` to `html` in VS Code. A `files.associations` entry wins over the `stx` language the extension registers, so `.stx` files would lose its features.

Use the workspace TypeScript version so the editor and `buddy test:types` evaluate the same compiler configuration.

These are optional, but they work well alongside it:

- EditorConfig
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
