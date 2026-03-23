---
name: stacks-server
description: Use when working with the Stacks development or production server — server configuration, server middleware, or server startup. Covers @stacksjs/server and storage/framework/server/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Server

## Key Paths
- Core package: `storage/framework/core/server/src/` (published as `@stacksjs/server`)
- Server runtime: `storage/framework/server/` (the actual Bun HTTP server + Docker build)
- Server types: `storage/framework/core/types/src/server.ts`
- Ports types: `storage/framework/core/types/src/ports.ts`
- Package (core): `storage/framework/core/server/package.json`
- Package (runtime): `storage/framework/server/package.json`

## Source Files
```
core/server/src/
├── index.ts               # Re-exports: config, controllers/base, imports, maintenance
├── config.ts              # config() factory — maps ServerOptions.type to host/port
├── config-production.ts   # Minimal env-based config for compiled production binaries
├── imports.ts             # Auto-import system: scan models/jobs/controllers, register bun plugin
├── maintenance.ts         # Laravel-like maintenance mode (down/up/bypass)
└── controllers/
    └── base.ts            # Base Controller class with json/success/error helpers

server/
├── src/
│   ├── index.ts           # Bun.serve() entry point — HTTP + WebSocket + job worker
│   └── utils.ts           # Docker build helpers (cleanCopy, buildDockerImage, useCustomOrDefaultServerConfig)
├── build.ts               # Full build pipeline: bundle server + app, post-process, optionally build Docker
├── dev                    # Shell script for local/remote Docker dev (mounts volumes)
├── Dockerfile             # Multi-stage Bun Docker image (oven/bun:1.3.10)
├── package.json           # stacks-server v0.70.23
├── tsconfig.json          # Extends core tsconfig
├── tsconfig.docker.json   # Docker-specific tsconfig with path aliases
├── .dockerignore          # Excludes Dockerfile, .git, node_modules, etc.
└── .gitignore             # Excludes app/, config/, dist/, storage/ (build artifacts)
```

## Server Entry Point (server/src/index.ts)

The runtime server uses `Bun.serve()` directly. It handles two modes based on environment variables:

### HTTP Server Mode (default)
```typescript
import type { Server, ServerWebSocket } from 'bun'

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  development: process.env.APP_ENV?.toLowerCase() !== 'production',

  async fetch(request: Request, server: Server<any>): Promise<Response | undefined> {
    // Attempt WebSocket upgrade first
    if (server.upgrade(request)) return

    // Delegate to the Stacks router
    return serverResponse(request)
  },

  websocket: {
    open(_ws: ServerWebSocket): void {},
    message(_ws: ServerWebSocket, _message: string): void {},
    close(_ws: ServerWebSocket, _code: number, _reason?: string): void {},
  },
})
```

Key details:
- `serverResponse()` is imported from `@stacksjs/router` and handles all route matching, middleware, and response generation
- WebSocket upgrade is attempted before HTTP routing
- `development` mode is enabled when `APP_ENV` is not `production` or `prod`
- SIGINT handler gracefully exits the process

### Queue Worker Mode
When `QUEUE_WORKER` env var is set, the same entry point runs a single job instead of starting the HTTP server:

```typescript
if (process.env.QUEUE_WORKER) {
  const jobName = process.env.JOB.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9_-]/g, '')
  const jobModule = await import(`./app/Jobs/${jobName}`)

  await retry(() => jobModule.default.handle(), {
    backoffFactor: Number(process.env.JOB_BACKOFF_FACTOR) || 2,
    retries: Number(process.env.JOB_RETRIES) || 3,
    initialDelay: Number(process.env.JOB_INITIAL_DELAY) || 1000,
    jitter: process.env.JOB_JITTER === 'true',
  })

  process.exit(0)
}
```

Environment variables for job execution:
- `QUEUE_WORKER` -- enables worker mode (any truthy value)
- `JOB` -- job file name (e.g., `SendEmail.ts`), sanitized to prevent path traversal
- `JOB_RETRIES` -- retry count (default: 3)
- `JOB_BACKOFF_FACTOR` -- exponential backoff multiplier (default: 2)
- `JOB_INITIAL_DELAY` -- initial retry delay in ms (default: 1000)
- `JOB_JITTER` -- enable jitter on retries (`'true'` to enable)

## Server Config (core/server/src/config.ts)

```typescript
function config(options: ServerOptions): { host: string, port: number, open: boolean }
```

Maps a `ServerOptions.type` to a host/port pair using the `ports` config object. Supported types:

| Type          | Port Source         |
|---------------|---------------------|
| `frontend`    | `ports.frontend`    |
| `backend`     | `ports.backend`     |
| `api`         | `ports.api`         |
| `admin`       | `ports.admin`       |
| `library`     | `ports.library`     |
| `desktop`     | `ports.desktop`     |
| `docs`        | `ports.docs`        |
| `email`       | `ports.email`       |
| `inspect`     | `ports.inspect`     |
| `system-tray` | `ports.systemTray`  |
| `database`    | `ports.database`    |

All types resolve to `host: 'localhost'`. If no type is provided or it doesn't match, falls back to `host: options.host || 'stacks.localhost'` and `port: options.port || 3000`.

### ServerOptions Type
```typescript
interface ServerOptions {
  type?: 'frontend' | 'backend' | 'api' | 'library' | 'desktop'
       | 'docs' | 'email' | 'admin' | 'system-tray' | 'database'
  host?: string
  port?: number
  open?: boolean
}
```

### Ports Interface
```typescript
interface Ports {
  frontend: number
  backend: number   // proxies api
  admin: number
  library: number
  desktop: number
  email: number
  docs: number
  inspect: number
  api: number       // the bun server
  systemTray: number
  database: number  // i.e. DynamoDB local
}
```

## Production Config (core/server/src/config-production.ts)

Minimal config for compiled binaries -- no runtime file loading, all env-based:

```typescript
const config = {
  app: {
    name: process.env.APP_NAME || 'Stacks',
    env: process.env.APP_ENV || 'production',
    debug: process.env.APP_DEBUG === 'true' || false,
    url: process.env.APP_URL || 'https://stacksjs.com',
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: '0.0.0.0',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
}
```

Used by `start.ts` (the production binary entry point) with `SKIP_CONFIG_LOADING=true` to bypass dynamic config imports.

## Production Start (core/server/src/start.ts)

Entry point for compiled production binaries. Sequence:

1. Sets `__STACKS_BINARY_MODE__ = true` on `globalThis` (prevents auto-registration in routes)
2. Sets `SKIP_CONFIG_LOADING = 'true'` env var
3. Imports `loadRoutes` and `serve` from `@stacksjs/router`
4. Loads routes from `app/Routes` registry via `loadRoutes(routeRegistry)`
5. Loads ORM auto-generated routes from `../../orm/routes` (model CRUD endpoints)
6. Calls `serve({ port, host })` to start the Bun HTTP server

```typescript
// Production startup flow
loadRoutes(routeRegistry)
  .then(async () => {
    await import('../../orm/routes')   // ORM auto-routes (after manual routes)
    serve({ port: config.server.port, host: config.server.host })
  })
```

## Auto-Imports System (core/server/src/imports.ts)

### initiateImports()
```typescript
function initiateImports(): void
```

Registers a Bun bundler plugin (`bun-plugin-auto-imports`) that makes models, jobs, controllers, and resource functions available globally without explicit imports.

Scan order (user overrides framework overrides defaults):
- **Models**: `app/Models/` > `storage/framework/models/` > `storage/framework/defaults/models/`
- **Jobs**: `app/Jobs/`
- **Controllers**: `app/Controllers/` > `storage/framework/defaults/app/Controllers/`
- **Functions**: `resources/functions/`

Outputs:
- `.d.ts` file: `storage/framework/types/server-auto-imports.d.ts`
- ESLint config: `storage/framework/server-auto-imports.json`
- Runtime index files: `storage/framework/auto-imports/` (see below)

### generateAutoImportFiles()
```typescript
async function generateAutoImportFiles(): Promise<void>
```

Generates runtime-importable index files under `storage/framework/auto-imports/`:
- `functions.ts` -- re-exports from `resources/functions/`
- `models.ts` -- re-exports default exports from model definition files as named exports
- `jobs.ts` -- re-exports default exports from job definition files
- `controllers.ts` -- re-exports default exports from controller definition files
- `index.ts` -- combined re-export of all above
- `globals.ts` -- script that assigns all exports to `globalThis`

### injectGlobalAutoImports()
```typescript
async function injectGlobalAutoImports(): Promise<void>
```

Dynamically imports `storage/framework/auto-imports/index.ts` and assigns all exports to `globalThis`. Call this early in application startup to make models available globally (e.g., `Post.where('title', 'test')` without imports).

### scanDefineModelExports(dir: string): ExportInfo[]
Internal helper that scans a directory for `.ts` files (excluding `.d.ts`, `index.ts`, `README*`) and returns file names as export info. Used for models, jobs, and controllers that use `export default defineModel(...)` pattern.

## Base Controller (core/server/src/controllers/base.ts)

```typescript
class Controller {
  protected json(data: any, status?: number): ResponseData      // default status: 200
  protected success(data: any): ResponseData                     // alias for json(data, 200)
  protected created(data: any): ResponseData                     // json(data, 201)
  protected noContent(): any                                     // response.noContent()
  protected error(message: string, status?: number): ResponseData // json({ error }, 500)
  protected notFound(message?: string): ResponseData             // error(msg, 404)
  protected unauthorized(message?: string): ResponseData         // error(msg, 401)
  protected forbidden(message?: string): ResponseData            // error(msg, 403)
  protected validate(request: Request, rules: Record<string, any>): Promise<void>
}
```

Usage:
```typescript
import { Controller } from '@stacksjs/server'

class UserController extends Controller {
  async index() {
    const users = await User.all()
    return this.success(users)
  }

  async store(request: Request) {
    await this.validate(request, { name: 'required', email: 'required|email' })
    const user = await User.create(request.body)
    return this.created(user)
  }

  async show(id: number) {
    const user = await User.find(id)
    if (!user) return this.notFound('User not found')
    return this.success(user)
  }
}
```

## Maintenance Mode (core/server/src/maintenance.ts)

Laravel-like maintenance mode that writes/removes a `storage/framework/down` file.

### Core Functions

```typescript
async function down(options?: Partial<MaintenancePayload>): Promise<void>
async function up(): Promise<void>
async function isDownForMaintenance(): Promise<boolean>
async function maintenancePayload(): Promise<MaintenancePayload | null>
```

### MaintenancePayload
```typescript
interface MaintenancePayload {
  time: number           // When maintenance was activated (Date.now())
  message?: string       // Display message (default: 'We are currently performing maintenance...')
  retry?: number         // Retry-After header value in seconds
  secret?: string        // Bypass token
  allowed?: string[]     // Allowed IP addresses
  status?: number        // HTTP status (default: 503)
  template?: string      // Custom template path
  redirect?: string      // Redirect URL instead of showing maintenance page
}
```

### Bypass Helpers
```typescript
function isAllowedIp(ip: string, allowed?: string[]): boolean
// Localhost IPs ('127.0.0.1', '::1', 'localhost') are always allowed

function hasValidBypassCookie(cookies: Record<string, string>, secret: string): boolean
// Checks for cookie: stacks_maintenance_bypass=<secret>

function isSecretPath(path: string, secret: string): boolean
// Matches /<secret> or /<secret>/...

function bypassCookieValue(secret: string): string
// Returns: 'stacks_maintenance_bypass=<secret>; Path=/; HttpOnly; SameSite=Lax'
```

### Response Helpers
```typescript
function maintenanceHtml(payload: MaintenancePayload): string
// Returns a styled HTML page with gradient background

function maintenanceResponse(payload: MaintenancePayload): Response
// Returns Response with correct status, Retry-After header, or 302 redirect
```

### Usage
```typescript
import { down, up, isDownForMaintenance } from '@stacksjs/server'

// Put app in maintenance mode with bypass secret
await down({ secret: 'my-bypass-token', retry: 300 })

// Check if in maintenance
if (await isDownForMaintenance()) {
  const payload = await maintenancePayload()
  // ...
}

// Bring app back up
await up()
```

## Docker Build Pipeline (server/build.ts)

The build process (`bun build.ts` from `storage/framework/server/`):

1. **Stop existing container**: Checks for running `stacks-server` Docker container and stops it
2. **Clean previous build**: Deletes `app/`, `config/`, `dist/`, `docs/`, `storage/` from server dir
3. **Bundle server**: `Bun.build()` with `entrypoints: ['./src/index.ts']`, output to `./dist`, ESM format, `target: 'bun'`
4. **Bundle app**: Scans all `*.ts` and `*.js` files under `app/`, builds to `server/app/`, splitting disabled, `@swc/wasm` externalized
5. **Post-process app**: Rewrites `storage/framework/server` references to `dist` in output JS files
6. **Post-process dist**: Strips `export { ENV_KEY, ENV_SECRET, fromEnv };` from bundled output (workaround for bundler issue)
7. **Build Docker image** (conditional): Only if `cloud.api?.deploy` is truthy

### Docker Build (server/src/utils.ts)

```typescript
async function buildDockerImage(): Promise<void>
async function useCustomOrDefaultServerConfig(): Promise<void>
async function cleanCopy(sourcePath: string, targetPath: string): Promise<void>
```

`buildDockerImage()`:
- Cleans old CDK artifacts (`cdk.out/`, `cdk.context.json`, `dist.zip`)
- Removes `.DS_Store`, sourcemaps, cache files
- Copies `config/`, `docs/`, `storage/`, `.env` into `server/`
- Optimizes: strips `node_modules`, `src/`, `types/`, `cloud/cdk_out`
- Runs `docker build --pull -t <app-slug> .`

`useCustomOrDefaultServerConfig()`: If a `server/` directory exists at project root, copies it into the framework server directory, otherwise uses defaults.

## Dockerfile

Multi-stage build based on `oven/bun:1.3.10`:

```dockerfile
# Builder stage
FROM oven/bun:1.3.10 AS builder
WORKDIR /usr/src
COPY ./app ./config ./docs ./dist ./tsconfig.docker.json ./

# Release stage
FROM oven/bun:1.3.10 AS release
WORKDIR /usr/src
# Copies app, config, docs, dist, tsconfig from builder
# Sets up /usr/src/storage as a volume
# Installs curl for healthcheck
# Runs as non-root 'bun' user
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "dist/index.js"]
```

## dev Script (server/dev)

Shell script for running the Docker container locally or against remote storage (EFS):

```sh
# Local development (mounts project directories as volumes)
./dev local
# docker run -p 3000:3000 -v app:/usr/src/app/app -v config:... -v storage:... stacks

# Remote/EFS (default — uses /mnt/efs for storage)
./dev
# Same volume mounts but storage points to /mnt/efs
```

## Environment Variables

| Variable              | Default            | Used In              |
|-----------------------|--------------------|----------------------|
| `PORT`                | `3000`             | server/src/index.ts, config-production.ts |
| `APP_ENV`             | `'production'`     | config-production.ts, server/src/index.ts |
| `APP_NAME`            | `'Stacks'`         | config-production.ts |
| `APP_URL`             | `'https://stacksjs.com'` | config-production.ts |
| `APP_DEBUG`           | `false`            | config-production.ts |
| `LOG_LEVEL`           | `'info'`           | config-production.ts |
| `SKIP_CONFIG_LOADING` | unset              | start.ts (set to `'true'`) |
| `QUEUE_WORKER`        | unset              | server/src/index.ts  |
| `JOB`                 | required if worker | server/src/index.ts  |
| `JOB_RETRIES`         | `3`                | server/src/index.ts  |
| `JOB_BACKOFF_FACTOR`  | `2`                | server/src/index.ts  |
| `JOB_INITIAL_DELAY`   | `1000`             | server/src/index.ts  |
| `JOB_JITTER`          | `'false'`          | server/src/index.ts  |

## CLI Commands
- `buddy dev` or `bun run dev` -- start development server (uses `storage/framework/server/src/index.ts` with hot reload)
- `buddy serve` or `bun run serve` -- start production server
- `buddy build:server` -- run the Docker build pipeline (`storage/framework/server/build.ts`)
- `buddy down` -- put app in maintenance mode
- `buddy up` -- bring app out of maintenance mode

## Gotchas
- The server lives in TWO places: `storage/framework/core/server/` is the published `@stacksjs/server` package (config, controllers, imports, maintenance); `storage/framework/server/` is the actual runtime Bun HTTP server and Docker build infrastructure
- The server runtime (`storage/framework/server/`) has its own `package.json`, `tsconfig.json`, and is excluded from workspaces -- it is a standalone deployable unit
- The `.gitignore` in `storage/framework/server/` excludes `app/`, `config/`, `dist/`, `storage/` because these are populated at build time by `build.ts`
- `start.ts` sets `__STACKS_BINARY_MODE__ = true` on `globalThis` -- this flag prevents route auto-registration and is only used for compiled production binaries
- Port configuration comes from `@stacksjs/config` (`ports` export), not from a standalone `config/ports.ts` file -- the Ports interface is defined in `storage/framework/core/types/src/ports.ts`
- The `config()` function always sets `open: false` (browser auto-open is commented out)
- The default host for unnamed server types is `'stacks.localhost'`, not `'localhost'`
- Production config binds to `0.0.0.0` (all interfaces), while development config uses `localhost`
- `serverResponse()` from `@stacksjs/router` is the single function that handles ALL HTTP request routing -- the server itself has no routing logic
- ORM auto-routes are loaded AFTER manual routes in `start.ts` so that `routeExists()` correctly detects conflicts
- The queue worker mode reuses the same entry point (`server/src/index.ts`) -- when `QUEUE_WORKER` is set, no HTTP server starts; it runs the job and exits
- Job names are sanitized with `/[^a-zA-Z0-9_-]/g` to prevent path traversal attacks
- `generateAutoImportFiles()` runs fire-and-forget during `initiateImports()` -- errors are logged but do not block server startup
- User models/controllers/jobs take priority over framework defaults due to deduplication order (user dirs are scanned first)
- The Docker image runs as non-root user `bun` with `/usr/src/storage` as a persistent volume
- `build.ts` strips `export { ENV_KEY, ENV_SECRET, fromEnv }` from bundled output as a workaround for a Bun bundler issue
- `tsconfig.docker.json` has path aliases that remap `@stacksjs/*` to `core/*/dist` -- this is critical for the Docker build to resolve packages without workspace symlinks
