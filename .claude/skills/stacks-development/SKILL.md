---
name: stacks-development
description: Use when setting up or configuring the Stacks development environment — dev server, hot reload, development utilities, or IDE configuration. Covers the @stacksjs/development package, the dev server, CLI commands, reverse proxy, SSL, and dev workflow.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Development

## Key Paths
- Development package: `storage/framework/core/development/` (stub — exports `{}`)
- Dev server entry: `storage/framework/server/src/index.ts`
- Dev server utils: `storage/framework/server/src/utils.ts`
- Server build script: `storage/framework/server/build.ts`
- Dev action handlers: `storage/framework/core/actions/src/dev/`
- Buddy CLI dev commands: `storage/framework/core/buddy/src/commands/dev.ts`
- Preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Port config: `config/ports.ts`
- STX config: `config/stx.ts`
- IDE defaults: `storage/framework/defaults/ide/`
- SSL setup: `storage/framework/core/actions/src/setup/ssl.ts`
- Bun config: `bunfig.toml`
- Dockerfile: `storage/framework/server/Dockerfile`

## Source Files
```
actions/src/dev/
├── index.ts            # Re-exports all run*DevServer() wrappers
├── api.ts              # API dev server (bun-router with CORS, port from config.ports.api)
├── views.ts            # Frontend dev server (bun-plugin-stx serve, .stx templates)
├── dashboard.ts        # Dashboard dev server (STX + native Craft window + config API)
├── dashboard-utils.ts  # Model discovery, sidebar config, icon map, waitForServer()
├── docs.ts             # Docs dev server (@stacksjs/bunpress, watch mode)
├── components.ts       # Components dev server (runs `bun run dev` in libs/components/vue)
├── desktop.ts          # Desktop dev server (runs `bun run dev` in framework/views/desktop)
└── system-tray.ts      # System tray dev server (runs `bun run dev` in framework/system-tray)

server/
├── src/
│   ├── index.ts        # Production server entry (Bun.serve, WebSocket, queue worker mode)
│   └── utils.ts        # cleanCopy(), useCustomOrDefaultServerConfig(), buildDockerImage()
├── build.ts            # Server build script (Bun.build for ESM, Docker image)
├── dev                 # Shell script for running server via Docker with volume mounts
├── Dockerfile          # Multi-stage build: oven/bun:1.3.10, exposes port 3000
├── package.json        # stacks-server package
├── tsconfig.docker.json
└── tsconfig.json

buddy/src/commands/
├── dev.ts              # All `buddy dev` subcommands
├── build.ts            # All `buddy build` subcommands
├── setup.ts            # `buddy setup` and `buddy setup:ssl`
├── doctor.ts           # `buddy doctor` health checks
└── maintenance.ts      # `buddy down`, `buddy up`, `buddy status`
```

## Port Configuration (config/ports.ts)

```typescript
{
  frontend: env.PORT ?? 3000,
  backend: env.PORT_BACKEND ?? 3001,
  admin: env.PORT_ADMIN ?? 3002,
  library: env.PORT_LIBRARY ?? 3003,
  desktop: env.PORT_DESKTOP ?? 3004,
  email: env.PORT_EMAIL ?? 3005,
  docs: env.PORT_DOCS ?? 3006,
  inspect: env.PORT_INSPECT ?? 3007,
  api: env.PORT_API ?? 3008,
  systemTray: env.PORT_SYSTEM_TRAY ?? 3009,
  database: 3010,
}
```

## CLI Commands

### Dev Server Commands
- `buddy dev` -- Start ALL dev servers in parallel (frontend, API, docs, dashboard + reverse proxy if custom domain)
- `buddy dev [server]` -- Start a specific server: `frontend`, `api`, `components`, `dashboard`, `desktop`, `system-tray`, `docs`
- `buddy dev -i` / `--interactive` -- Interactive prompt to choose which server to start
- `buddy dev --verbose` -- Show detailed output including proxy info and dependency logs
- `buddy dev:frontend` (aliases: `dev:pages`, `dev:views`) -- Frontend only
- `buddy dev:api` -- API server only
- `buddy dev:dashboard` (alias: `dev:admin`) -- Dashboard with native Craft window
- `buddy dev:docs` -- Documentation server only
- `buddy dev:components` -- Vue component library dev server
- `buddy dev:desktop` -- Desktop app dev server
- `buddy dev:system-tray` (alias: `dev:tray`) -- System tray dev server

### Build Commands
- `buddy build` -- Build stacks framework (default when no option specified)
- `buddy build components` -- Build component libraries
- `buddy build docs` -- Build documentation site
- `buddy build server` (alias: `build:docker`) -- Build Docker server image
- `buddy build:core` -- Build Stacks core packages
- `buddy build:stacks` -- Build the full Stacks framework
- `buddy build:cli` -- Build Buddy CLI binary

### Setup & Maintenance
- `buddy setup` (alias: `ensure`) -- Full project setup (pantry, deps, config)
- `buddy setup:ssl` (alias: `ssl:setup`) -- Generate and trust SSL certs for custom domain
- `buddy doctor` -- Health checks (Bun version, Node.js, package.json, .env, APP_KEY)
- `buddy fresh` -- Clean project + reinstall dependencies
- `buddy clean` -- Remove build artifacts via `cleanProject()`
- `buddy down` -- Maintenance mode (supports `--message`, `--secret`, `--retry`, `--allow`)
- `buddy up` -- Exit maintenance mode
- `buddy status` -- Check maintenance mode status

## Dev Server Architecture

### Unified Dev Server (`buddy dev` with no arguments)
When `buddy dev` runs without a specific server flag, `startDevelopmentServer()` in `dev.ts`:
1. Reads port configuration from env vars (`PORT`, `PORT_API`, `PORT_DOCS`, `PORT_ADMIN`)
2. Detects custom domain from `APP_URL` (e.g., `stacks.localhost`)
3. Prints Vite-style banner with URLs for Frontend, API, Docs, Dashboard
4. Sets `STACKS_PROXY_MANAGED=1` to prevent subprocesses from starting their own proxies
5. Starts all servers in parallel via `Promise.all()`:
   - `runFrontendDevServer()` -- STX template server on port 3000
   - `runApiDevServer()` -- bun-router API on port 3008
   - `runDocsDevServer()` -- bunpress docs on port 3006
   - `runDashboardDevServer()` -- STX + Craft native window on port 3002
   - `startReverseProxy()` -- rpx HTTPS proxy on port 443 (only if custom domain set)
6. Registers SIGINT/SIGTERM handlers that `SIGKILL` the entire process group

### Action Execution (`runAction` in helpers/utils.ts)
- Dev actions (paths starting with `dev/`) automatically get `--watch` flag via `bun --watch`
- The `dev/views` action is special-cased for maximum performance: imports `bun-plugin-stx/serve` directly instead of spawning a subprocess
- `NODE_PATH` is set to include `pantry/` so compiled pantry packages can resolve `@stacksjs/*` at runtime
- Dev action subprocess output is suppressed by default (quiet mode), visible with `--verbose`

### Frontend Dev Server (views.ts)
Uses `bun-plugin-stx` serve function with pattern-based view resolution:
- User views: `resources/views` (checked first)
- Default views: `storage/framework/defaults/resources/views` (fallback)
- User layouts: `resources/layouts`
- Default layouts: `storage/framework/defaults/resources/layouts`
- Components: `storage/framework/defaults/components/Dashboard`

### API Dev Server (api.ts)
- Uses `@stacksjs/router` with CORS middleware
- Calls `route.importRoutes()` to load route definitions
- Serves on `127.0.0.1` at `config.ports.api` (default 3008)

### Dashboard Dev Server (dashboard.ts)
- Starts STX server + config API + native Craft window in parallel
- Config API runs on `dashboardPort + 1` (default 3003), handles `POST /api/config/update`
- Config API allows live editing of `config/*.ts` files via regex-based key replacement
- Discovers ORM models from `app/Models/` and `storage/framework/defaults/models/`
- Writes `.discovered-models.json` manifest for sidebar population
- Opens `@craft-native/ts` native window (1400x900, titlebar hidden, native sidebar)
- Sidebar has 10 sections: Home, Library, Content, App, Data, Commerce, Marketing, Analytics, Management, Utilities

### Docs Dev Server (docs.ts)
- Uses `@stacksjs/bunpress` with `{ watch: true, quiet: true }`
- Serves from `docs/` directory on port 3006

## Reverse Proxy & HTTPS

When `APP_URL` is set to a custom domain (not `localhost`):
- `startReverseProxy()` uses `@stacksjs/rpx` to proxy all subdomains through HTTPS on port 443
- Proxy mapping: `localhost:3000 -> domain`, `localhost:3008 -> api.domain`, `localhost:3006 -> docs.domain`, `localhost:3002 -> dashboard.domain`
- SSL certs stored in `~/.stacks/ssl/` with 825-day validity
- Individual dev servers check `STACKS_PROXY_MANAGED` to avoid starting duplicate proxies

### SSL Setup (`setup/ssl.ts`)
- `setupSSL(options)` -- Complete SSL setup: hosts file + cert generation + trust
- `generateCertificates(domain)` -- Uses `@stacksjs/tlsx` to create Root CA + host cert
- `addDomainToHosts(domain)` -- Adds `127.0.0.1 <domain>` to `/etc/hosts` (requires sudo)
- `trustCertificate(domain)` -- Adds cert to macOS Keychain or Linux ca-certificates
- Supports non-interactive mode via `SUDO_PASSWORD` env var
- Cert files: `~/.stacks/ssl/<domain>.crt`, `<domain>.key`, `<domain>.ca.crt`

## Hot Reload / Watch Mode

- **Dev actions use `bun --watch`**: All actions with paths starting with `dev/` are automatically run with Bun's `--watch` flag, which restarts the process on file changes
- **Frontend (STX)**: `bun-plugin-stx/serve` has its own built-in watch/HMR for `.stx` templates
- **API server**: Runs via `bun --watch`, restarts on route or handler changes
- **Docs**: `@stacksjs/bunpress` runs with `watch: true` for live documentation updates
- **Components**: Delegates to the component library's own `bun run dev` (typically Vite-based HMR)

## Preloader (preloader.ts)

Configured in `bunfig.toml` as `preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]`.

### Execution Phases
1. **Fast command skip**: Commands like `dev`, `build`, `test`, `lint`, `--version`, `--help` skip the preloader entirely for maximum startup speed
2. **Environment detection**: Deploy/production commands (`deploy`, `cloud:remove`, etc.) set `APP_ENV` and `NODE_ENV` before loading env files
3. **Env loading**: Calls `autoLoadEnv({ quiet: true })` from `@stacksjs/env` for encrypted `.env` file support
4. **Auto-imports** (non-fast commands only):
   - Loads 21 `@stacksjs/*` packages into `globalThis` (actions, router, orm, validation, etc.)
   - Loads all functions from `resources/functions/**/*.ts`
   - Loads all ORM model instances into `globalThis` (priority: user > framework > defaults)
   - Loads all Job instances from `app/Jobs/` into `globalThis`
   - Loads all Controller classes into `globalThis`
   - Runs `discoverPackages()` for package auto-discovery
5. **Protected globals**: 80+ built-in names (process, console, Buffer, fetch, Bun, etc.) are never overwritten

### bunfig.toml Configuration
```toml
preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]

[test]
preload = ["./tests/setup.ts"]
coverage = true

[run]
bun = true  # equivalent to `bun --bun` for all `bun run` commands

[serve.static]
plugins = ["bun-plugin-stx"]  # STX template engine plugin for Bun.serve

[install]
registry = { url = "https://registry.npmjs.org/", token = "$BUN_AUTH_TOKEN" }
linker = "hoisted"
```

## Production Server (server/src/index.ts)

- **Queue worker mode**: When `QUEUE_WORKER` env var is set, imports and runs the job from `app/Jobs/<JOB>.ts` with retry support (configurable via `JOB_RETRIES`, `JOB_BACKOFF_FACTOR`, `JOB_INITIAL_DELAY`, `JOB_JITTER`)
- **HTTP server**: `Bun.serve()` on `PORT` (default 3000), delegates to `serverResponse()` from `@stacksjs/router`
- **WebSocket**: Built-in WebSocket upgrade support (open/message/close handlers as stubs)
- **Development mode**: Auto-enabled when `APP_ENV` is not `production` or `prod`
- **Docker**: Multi-stage build with `oven/bun:1.3.10`, runs as non-root `bun` user, exposes port 3000, includes curl for healthchecks

## Server Build Process (server/build.ts)

1. Stops any running `stacks-server` Docker container
2. Cleans previous build artifacts (app/, config/, dist/, docs/, storage/)
3. Builds server entry (`src/index.ts`) to `dist/` using `Bun.build` (ESM, target: bun)
4. Builds all `app/**/*.{ts,js}` files to `server/app/` (ESM, no splitting, external: `@swc/wasm`)
5. Post-processes built files: rewrites `storage/framework/server` imports to `dist/`
6. Strips `export { ENV_KEY, ENV_SECRET, fromEnv }` from dist (bundler workaround)
7. Copies custom server config if present (`server/` dir at project root)
8. Optionally builds Docker image if `cloud.api.deploy` is enabled

## IDE Support

Default configurations provided at `storage/framework/defaults/ide/`:

### Cursor
- `cursor/rules/`: 11 rule files (auto-imports, code-style, documentation, error-handling, key-conventions, project-structure, syntax-formatting, testing, typescript, ui-styling, readme)

### VS Code
- `vscode/.vscode/extensions.json` -- Recommended extensions
- `vscode/.vscode/settings.json` -- Editor settings
- `vscode/.vscode/stacks.code-snippets` -- Code snippets
- `vscode/package.json` -- VS Code extension manifest

### JetBrains
- `.idea/` config (ESLint, modules, VCS, web resources)
- `.fleet/settings.json` -- Fleet IDE settings
- `options/` (GitHub Copilot, Node.js config)
- `templates/` (JavaScript and Stacks live templates)

### Zed
- `zed/.zed/settings.json` -- Zed editor settings

### Dictionary
- `dictionary.txt` -- Custom spell-check dictionary

## Doctor Health Checks

`buddy doctor` verifies:
- Bun runtime version (pass if v1.0+, warn otherwise, fail if missing)
- Node.js version (pass if v18+, warn otherwise)
- package.json existence and project name
- `.env` file presence (warn if missing, not a failure)
- `APP_KEY` is set (warn if not, suggests `buddy key:generate`)

## STX Configuration (config/stx.ts)

```typescript
{
  componentsDir: 'resources/components',
  layoutsDir: 'resources/layouts',
  partialsDir: 'resources/partials',
}
```

Note: Dashboard mode overrides these settings via its own `serve()` options.

## Gotchas
- The `@stacksjs/development` package is currently a stub (`export {}`) -- all actual dev tooling lives in the actions and server packages
- The preloader skips entirely for `dev`, `build`, `test`, `lint`, and version/help commands -- auto-imports are NOT available in those contexts
- `buddy dev` (no arguments) starts ALL servers simultaneously -- use `buddy dev api` or `buddy dev frontend` to start only one
- The `STACKS_PROXY_MANAGED=1` env var prevents individual dev servers from starting their own reverse proxy -- only the unified `buddy dev` command manages the proxy
- Dev actions are executed with `bun --watch` automatically -- do NOT add `--watch` manually or you get double-restart behavior
- The `dev/views` action is special-cased in `runAction()` to run in-process (no subprocess) for performance -- other dev actions spawn subprocesses
- `NODE_PATH` is injected to include `pantry/` directory so compiled pantry packages can resolve `@stacksjs/*` dependencies at runtime
- The dashboard config API (port 3003) modifies `config/*.ts` files via regex replacement -- it only handles simple key-value patterns, not nested objects or arrays
- SSL certificates are stored in `~/.stacks/ssl/`, NOT in the project directory -- they persist across projects using the same domain
- Custom server configuration in `server/` at the project root overrides the default server config via file copy (checked by `useCustomOrDefaultServerConfig()`)
- The production server doubles as a queue worker when `QUEUE_WORKER` env var is set -- it imports the job by name from `app/Jobs/` and exits after completion
- Docker build strips `src/` directories, test files, sourcemaps, and `node_modules` from the image to minimize size
- The `bun-plugin-stx` serve plugin is resolved with a fallback: first tries normal `import('bun-plugin-stx/serve')`, then falls back to `pantry/bun-plugin-stx/dist/serve.js`
- `buddy fresh` is NOT the same as `buddy clean` -- `fresh` cleans AND reinstalls dependencies, while `clean` only removes artifacts
- The Craft native window for the dashboard uses `http://localhost:<port>` directly (not HTTPS) even when a custom domain proxy is running
