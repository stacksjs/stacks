# Stacks for VS Code

Build a Stacks app without leaving the editor. Start the dev server, preview it in VS Code's built-in Simple Browser, and run any `buddy` command from the Command Palette. The extension also installs a small pack of extensions that Stacks projects are configured for.

The extension activates in workspaces that contain a `buddy` file or a `config/app.ts`.

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type `Stacks`.

| Command | What it does |
|---|---|
| **Stacks: Open Preview** | Opens the running dev server in the Simple Browser, beside your editor. If nothing is running, it offers to start the dev server. |
| **Stacks: Start Dev Server** | Runs `./buddy dev` in a terminal named `Stacks Dev` at the project root. Once the server is up, the preview opens in the Simple Browser. |
| **Stacks: Run Buddy Command...** | Lists every command `./buddy list` knows, including your own in `app/Commands/`. Pick one, and if it takes arguments you are asked for them. You can also type a full command line, such as `migrate --diff` or `make:model Post`. The command runs in a terminal named `Stacks Buddy`. |

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

The extension also sets a few editor defaults for Stacks projects: `.stx` files use HTML language support, the `buddy` script is highlighted as a shell script, `npm.packageManager` is `bun`, Go to Definition prefers source files over `.d.ts`, and TypeScript uses the workspace version.

## Included extensions

- [Bun for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) - Bun runtime and test integration
- [Dotenvx](https://marketplace.visualstudio.com/items?itemName=dotenv.dotenvx-vscode) - encrypted environment file support
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - editor integration for the project's lint rules
- [markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) - Markdown linting
- [shell-format](https://marketplace.visualstudio.com/items?itemName=foxundermoon.shell-format) - shell script and Dockerfile formatting
- [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - spell checking with the Stacks dictionary
- [Total TypeScript Error Translator](https://marketplace.visualstudio.com/items?itemName=mattpocock.ts-error-translator) - plain-English TypeScript errors
- [Prettify TypeScript](https://marketplace.visualstudio.com/items?itemName=mylesmurphy.prettify-ts) - readable type hovers
- [Twoslash Query Comments](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-twoslash-queries) - inline `// ^?` type queries
- [AWS Toolkit](https://marketplace.visualstudio.com/items?itemName=amazonwebservices.aws-toolkit-vscode) - the AWS resources `buddy deploy` creates

Some extensions were dropped from the pack because VS Code now does the same thing itself:

- **Goto Definition Alias**: built-in **Go to Source Definition**, which this extension enables by default.
- **npm Intellisense**: TypeScript's built-in package import completions.
- **DotENV**: VS Code's built-in `dotenv` language highlights `.env` and `.env.*` files.
- **Gremlins**: built-in Unicode highlighting (`editor.unicodeHighlight.*`) flags invisible and confusable characters.

## Development

```bash
bun run build      # bundle src/ into dist/extension.js
bun test ./tests   # unit tests for URL detection, `buddy list` parsing and the commands
bun run typecheck
bun run package    # build and create a .vsix
code --install-extension vscode-stacks-<version>.vsix
```

The extension has no runtime dependencies. It is published automatically by the Stacks release workflow, and `vscode:prepublish` builds `dist/` first.

## Relevant links

- [GitHub](https://github.com/stacksjs/stacks)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=stacks.vscode-stacks)
- [IDE setup guide](https://stacksjs.com/docs/bootcamp/how-to/ide-setup)
