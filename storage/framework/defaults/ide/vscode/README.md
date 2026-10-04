# Stacks for VS Code

Everything a Stacks project needs in the editor, in one extension: stx templates, pickier linting and formatting, encrypted env files, the dev server preview and every `buddy` command. It installs no other extensions and works without any.

The Stacks commands, pickier and the env features activate in workspaces that contain a `buddy` file or a `config/app.ts`. stx support also starts for any `.stx` file.

## stx templates

`.stx` files get the full stx language support: highlighting, completions for directives, components and props, hovers, diagnostics, go to definition, folding, semantic highlighting, snippets, and previews of utility classes with their colors.

The TypeScript in `.stx` files, `<script>` blocks and `{{ }}` template expressions alike, is type-checked by the TypeScript server, with its hovers, completions and go to definition, against the same declarations `stx typecheck` uses: `import { state } from 'stx'` resolves to exactly what the runtime binds. Turn it off with `stxTypescriptPlugin.enabled`.

It is the same code as the standalone [stx extension](https://marketplace.visualstudio.com/items?itemName=Stacks.vscode-stx) (`Stacks.vscode-stx`), built in from `@stacksjs/stx-vscode`. You do not need that extension; if you have both, it stands down so nothing is registered twice, and the TypeScript plugin both contribute checks each file once.

## Pickier

Files `./buddy lint` checks (`.ts`, `.js`, `.json`, `.md`, `.yaml`) are linted as you type, with the project's own pickier and its config (`config/code-style.ts`, `pickier.config.ts` or `.config/pickier.ts`), so the editor and `./buddy lint` always agree. Pickier runs in a Bun process per project, on the project's `pantry/.bin/bun` when it has one.

- **Format Document** formats with pickier when the extension is the formatter: `"editor.defaultFormatter": "Stacks.vscode-stacks"`, which new projects already set.
- **Fix all**: the `source.fixAll.pickier` code action applies every fix `./buddy lint --fix` would. New projects run it on save through `"editor.codeActionsOnSave": { "source.fixAll.pickier": "explicit" }`. It needs pickier 0.1.66 or later.
- **Quick fixes** on a pickier problem: fix all, or `// pickier-disable-next-line <rule>` for that line.

## Env files

- **Hover** an `encrypted:` value to see it decrypted, with the same code and keys `./buddy env:get` uses: `DOTENV_PRIVATE_KEY_<ENV>` or `DOTENV_PRIVATE_KEY`, from `.env.keys` or the environment. The value is only shown; it is never cached, logged or written anywhere.
- **Missing keys**: keys `.env.example` declares that `.env` does not set are flagged in `.env`.
- **Commands** run the project's `./buddy env:*` directly, without a shell, so a value you set does not end up in your shell history. They act on the env file that is open, or `.env`.
- The **preview** decrypts an encrypted `APP_URL` or `PORT` the same way, so it opens the URL `./buddy dev` serves.

VS Code highlights `.env` files itself.

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type `Stacks`.

| Command | What it does |
|---|---|
| **Stacks: Open Preview** | Opens the running dev server in the Simple Browser, beside your editor. If nothing is running, it offers to start the dev server. |
| **Stacks: Start Dev Server** | Runs `./buddy dev` in a terminal named `Stacks Dev` at the project root. Once the server is up, the preview opens in the Simple Browser. |
| **Stacks: Run Buddy Command...** | Lists every command `./buddy list` knows, including your own in `app/Commands/`. Pick one, and if it takes arguments you are asked for them. You can also type a full command line, such as `migrate --diff` or `make:model Post`. The command runs in a terminal named `Stacks Buddy`. |
| **Stacks: Fix All Lint Problems** | Applies pickier's fixes to the open file. |
| **Stacks: Restart Pickier** | Restarts the pickier process, after changing its config outside the editor or updating pickier. Saving the config in the editor restarts it for you. |
| **Stacks: Env: Get Value...** | `./buddy env:get`: pick a key, then copy its value. |
| **Stacks: Env: Set Value...** | `./buddy env:set`: the value is typed into a password box, and encrypted when the file is. |
| **Stacks: Env: Encrypt File** | `./buddy env:encrypt`. |
| **Stacks: Env: Decrypt File** | `./buddy env:decrypt`, after a warning: it writes every value to disk in plaintext. |
| **Stacks: Env: Rotate Keys** | `./buddy env:rotate`, after a warning: deployments holding the old private key can no longer decrypt the file. |

The **Stacks** item in the status bar opens the preview.

Every command runs the project's own `./buddy`, relative to the workspace root. A `buddy` on your `PATH` or in `node_modules/.bin` is never used, because that name can also belong to an unrelated tool, such as the `@buddysh/buddy` dependency bot.

## Finding the preview URL

When the extension starts the dev server, it reads the URL `buddy dev` prints in its ready banner (for example `App: https://stacks.localhost/dashboard`). That URL already accounts for a shifted port and the app's entry page.

Otherwise it works the URL out the same way `buddy dev` does, from `.env`, `.env.local`, `.env.development` and `.env.development.local`:

- The frontend listens on `PORT`, or `3000` if it is not set.
- If `APP_URL` (default `stacks.localhost`) is not a localhost address, the app is served at `https://<APP_URL>` through the local HTTPS proxy. `STACKS_DEV_LOCALHOST=1` turns this off.
- `APP_PATH`, or `appPath` in `config/app.ts`, is appended as the entry page.

The extension checks that the frontend port is accepting connections before it opens anything. It uses the `https://` URL only when the proxy answers too, and falls back to `http://localhost:<PORT>` otherwise. In a remote window (SSH, WSL, Codespaces) localhost URLs are port-forwarded automatically.

## Settings

| Setting | Default | Description |
|---|---|---|
| `stacks.preview.url` | `""` | Always open this URL, e.g. `http://localhost:3000/dashboard`. Leave empty to detect it. |
| `stacks.preview.preferLocalhost` | `false` | Preview `http://localhost:<PORT>` even when `APP_URL` is a pretty `https://` domain. Use this if the Simple Browser stays blank because the local certificate is not trusted. |
| `stacks.devServer.args` | `[]` | Extra arguments for `./buddy dev`, e.g. `["frontend"]` or `["--site"]`. |
| `stacks.devServer.openPreview` | `true` | Open the Simple Browser once the dev server is up, instead of letting `buddy dev` open your system browser. |
| `stacks.statusBar.enabled` | `true` | Show the Stacks status bar item. |
| `stacks.pickier.enable` | `true` | Lint, format and fix with the project's pickier. |
| `stacks.pickier.run` | `"onType"` | Lint as you type (`onType`) or only on save (`onSave`). |
| `stacks.bunPath` | `""` | The Bun that runs pickier. Empty means the project's `pantry/.bin/bun`, then `bun` on the `PATH`. |
| `stacks.env.decryptOnHover` | `true` | Show encrypted env values decrypted on hover. |
| `stacks.env.missingKeys` | `true` | Flag keys `.env.example` has that `.env` does not set. |

The `stx.*` settings (diagnostics, completion, hover, utility classes and so on) are the stx extension's, and work the same here.

The extension also sets a few editor defaults for Stacks projects: the `buddy` script is highlighted as a shell script, `npm.packageManager` is `bun`, Go to Definition prefers source files over `.d.ts`, and TypeScript uses the workspace version.

## No extension pack

Earlier versions installed a pack of other extensions. It is gone, and the extension depends on none:

- **stx Language Support**, **ESLint** and **Dotenvx** are replaced by the built-in stx, pickier and env support above. Stacks lints with pickier, not ESLint.
- **Bun for Visual Studio Code**, **AWS Toolkit**, **markdownlint**, **shell-format**, **Code Spell Checker**, **Total TypeScript Error Translator**, **Prettify TypeScript** and **Twoslash Query Comments** were dropped. They are general-purpose tools rather than anything Stacks-specific, and markdownlint and shell-format formatted files pickier formats. Install any of them yourself if you want them.

## Development

```bash
bun run build      # bundle src/ into dist/ (extension, pickier worker, stx assets)
bun test ./tests   # unit tests, plus a build that must load as CommonJS on Node
bun run typecheck
bun run sync:stx   # after updating @stacksjs/stx-vscode: copy its contributions into package.json
bun run package    # build and create a .vsix
code --install-extension vscode-stacks-<version>.vsix
```

The extension has no runtime dependencies: `@stacksjs/stx-vscode` and the env decryption from `core/env` are bundled into `dist/extension.js`. The one exception is the stx TypeScript plugin, which tsserver loads by package name from the extension's `node_modules`: `bun run package` (and `bun run release`, which publishes that VSIX) adds it there after `vsce package --no-dependencies`, which leaves `node_modules` out. It is published automatically by the Stacks release workflow, and `vscode:prepublish` builds `dist/` first.

## Relevant links

- [GitHub](https://github.com/stacksjs/stacks)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Stacks.vscode-stacks)
- [IDE setup guide](https://stacksjs.com/docs/bootcamp/how-to/ide-setup)
