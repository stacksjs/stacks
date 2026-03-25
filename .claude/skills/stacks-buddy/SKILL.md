---
name: stacks-buddy
description: Use when working with the Stacks CLI (buddy/bud/stacks/stx) — understanding all 50+ commands with their flags and options, adding custom commands, the make:* scaffolding commands, development server commands, build commands, deployment commands, email/mail commands, environment management, or domain/DNS commands. Covers @stacksjs/buddy and all CLI command files.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Buddy CLI

The complete CLI runtime for the Stacks framework with 50+ commands, lazy-loaded for fast cold starts.

## Key Paths
- Core package: `storage/framework/core/buddy/src/`
- CLI entry point: `storage/framework/core/buddy/src/cli.ts`
- Commands directory: `storage/framework/core/buddy/src/commands/`
- Lazy command registry: `storage/framework/core/buddy/src/lazy-commands.ts`
- Config system: `storage/framework/core/buddy/src/config.ts`
- Shell entry: `buddy` (shell script at project root that invokes `bun run ./storage/framework/core/buddy/src/cli.ts`)
- Application commands: `app/Commands/`
- Command registry: `app/Commands.ts`
- Make templates: `storage/framework/defaults/`

## CLI Aliases
All invoke the same CLI: `./buddy`, `bud`, `stacks`, `stx`

## Architecture

### Lazy Loading System
Commands are lazy-loaded for performance. The `lazy-commands.ts` file maps command names to their file paths and export names. When a command is invoked, only that command's module is loaded.

```typescript
// lazy-commands.ts registry structure
const commandRegistry: Record<string, CommandLoader> = {
  'about': { path: './commands/about.ts', exportName: 'about' },
  'build': { path: './commands/build.ts', exportName: 'build' },
  // ... 40+ more entries
}
```

Key functions:
- `loadCommand(name, buddy)` - Load a single command lazily
- `loadCommands(names, buddy)` - Load multiple commands with 5-second timeout per command
- `loadCommandGroup(groupName, buddy)` - Load related commands ('development', 'database', 'scaffolding', 'deployment', 'info')
- `loadAllCommands(buddy)` - Load all commands (for interactive mode or `list` command)
- `getCommandsToLoad(args)` - Determine which commands to load based on CLI arguments
- `getCommandNames()` - Get all command names without loading them (for autocomplete)

Command groups defined in lazy-commands.ts:
- `minimal`: version, help
- `development`: dev, build, test, lint
- `database`: migrate, seed, fresh
- `scaffolding`: make, generate
- `deployment`: deploy, release, cloud
- `info`: about, doctor, list

### Startup Flow (cli.ts)
1. Parse args to determine requested command
2. Skip expensive setup for minimal commands (--version, --help, help, version)
3. For full commands: load setup + key commands, check APP_KEY, load lazy commands, load user commands from `app/Commands/`
4. For no arguments with interactive TTY: show interactive menu with select prompt
5. Parse and execute

### Commands that skip APP_KEY check
`build`, `lint`, `lint:fix`, `test`, `test:types`, `test:unit`, `test:feature`, `typecheck`, `types:fix`, `types:generate`, `clean`, `fresh`, `about`, `doctor`, `setup`, `setup:ssl`, `setup:oh-my-zsh`, `deploy`

### buddy.config.ts Support
Optional config file at project root. Validated with `validateConfig()`. Supports:
```typescript
interface BuddyConfig {
  theme?: 'default' | 'dracula' | 'nord' | 'solarized' | 'monokai'
  emoji?: boolean
  commands?: Array<(cli: CLI) => void>
  defaultFlags?: { verbose?: boolean, quiet?: boolean, debug?: boolean }
  aliases?: Record<string, string>  // e.g. { 'r': 'release' }
  plugins?: Array<BuddyPlugin | string>
}
```

Config files searched in order: `buddy.config.ts`, `buddy.config.js`, `.buddy.config.ts`, `.buddy.config.js`

### Plugin System
Plugins can register commands, add hooks (beforeCommand/afterCommand):
```typescript
interface BuddyPlugin {
  name: string
  version?: string
  setup: (cli: CLI) => void | Promise<void>
  hooks?: {
    beforeCommand?: (context: any) => void | Promise<void>
    afterCommand?: (context: any) => void | Promise<void>
  }
}
```

## Interactive Mode
When buddy is invoked with no arguments on an interactive TTY, it shows a select menu:
- Start development server
- Build for production
- Run tests
- List all commands
- Run health checks
- Show system information
- Show help
- Exit

---

## Development Commands

### `buddy dev [server]` - Start development server(s)
```bash
buddy dev                    # start ALL dev servers (frontend, API, docs, dashboard) + reverse proxy
buddy dev frontend           # frontend only (positional arg)
buddy dev api                # API only
buddy dev docs               # documentation only
buddy dev dashboard          # dashboard only
buddy dev desktop            # desktop only
buddy dev system-tray        # system tray only
buddy dev -f/--frontend      # frontend only (flag)
buddy dev -a/--api           # API only
buddy dev -c/--components    # components dev server
buddy dev -d/--dashboard     # dashboard only
buddy dev -k/--desktop       # desktop only
buddy dev -o/--docs          # docs only
buddy dev -s/--system-tray   # system tray only
buddy dev -i/--interactive   # interactive server selection menu
buddy dev -l/--with-localhost # include localhost URL in output
buddy dev -p/--project [name]
buddy dev --verbose
```

Sub-commands with aliases:
```bash
buddy dev:components         # component library dev server
buddy dev:docs               # documentation dev server
buddy dev:desktop            # desktop app dev server
buddy dev:api                # API dev server
buddy dev:frontend           # frontend dev server (aliases: dev:pages, dev:views)
buddy dev:dashboard          # dashboard dev server (alias: dev:admin)
buddy dev:system-tray        # system tray dev server (alias: dev:tray)
```

When running `buddy dev` with no flags (all servers), it:
1. Prints Vite-style output showing all server URLs
2. Sets `STACKS_PROXY_MANAGED=1` env var
3. Starts frontend, API, docs, dashboard servers in parallel
4. If APP_URL has a custom domain, starts reverse proxy (rpx) for HTTPS with subdomains
5. Uses environment variables: `PORT` (default 3000), `PORT_API` (3008), `PORT_DOCS` (3006), `PORT_ADMIN` (3002)
6. Cleans up child processes on SIGINT/SIGTERM via `process.kill(0, 'SIGKILL')`

Reverse proxy (rpx):
- Proxies `localhost:PORT -> domain`, `localhost:PORT_API -> api.domain`, etc.
- SSL certs stored at `~/.stacks/ssl/`
- Only starts when APP_URL is set to a custom domain (not localhost)

---

## Build Commands

### `buddy build [type]` - Build for production
```bash
buddy build                  # defaults to building stacks framework
buddy build components       # positional: component library
buddy build vue              # Vue components
buddy build web-components   # web components
buddy build functions        # function library
buddy build views            # frontend views
buddy build docs             # documentation
buddy build buddy            # CLI binary
buddy build cli              # CLI binary (alias for buddy)
buddy build stacks           # framework
buddy build server           # Docker image
```

Flags:
```bash
buddy build -c/--components        # component library (Vue + Web Components)
buddy build -w/--web-components    # web component library only
buddy build -f/--functions         # function library
buddy build -p/--views/--pages     # frontend views
buddy build -d/--docs              # documentation site
buddy build -b/--buddy             # CLI binary
buddy build -s/--stacks            # framework core
buddy build --server               # Docker image
```

Sub-commands with aliases:
```bash
buddy build:components       # component libraries (alias: prod:components)
buddy build:cli              # CLI binary (alias: prod:cli)
buddy build:server           # Docker image (aliases: prod:server, build:docker)
buddy build:functions        # function library
buddy build:web-components   # web components (aliases: build:wc, prod:web-components, prod:wc)
buddy build:docs             # documentation (aliases: prod:docs, build:documentation, prod:documentation)
buddy build:core             # Stacks core packages
buddy build:desktop          # desktop application (alias: prod:desktop)
buddy build:stacks           # Stacks framework
```

---

## Database Commands

### `buddy migrate` - Run database migrations
```bash
buddy migrate                # run pending migrations (alias: db:migrate)
buddy migrate -d/--diff      # show SQL that would be run without executing
buddy migrate -a/--auth      # also migrate auth tables (oauth_clients, oauth_access_tokens, etc.)
buddy migrate --verbose

buddy migrate:fresh          # drop all tables and re-migrate (alias: db:fresh)
buddy migrate:fresh -s/--seed   # seed after fresh migration
buddy migrate:fresh -a/--auth   # include auth tables
buddy migrate:fresh -d/--diff   # show SQL without running

buddy migrate:dns            # DNS migration for APP_URL domain
```

Both `migrate` and `migrate:fresh` validate that models exist in `app/Models` or `storage/framework/defaults/models` before running.

### `buddy seed` - Seed database
```bash
buddy seed                   # seed database (alias: db:seed)
buddy seed --verbose
```

---

## Code Generation (make:*)

### `buddy make [type]` - Scaffolding commands

All make commands accept `-n/--name [name]` and `--verbose` flags.

```bash
buddy make:action [name]      # create action in app/Actions/
buddy make:certificate        # generate SSL certificate (alias: make:cert)
buddy make:command [name]     # create CLI command in app/Commands/
  --signature [sig]           # CLI command name
  --description [desc]        # command description
  --no-register               # skip registering in Commands.ts
buddy make:component [name]   # create STX component
buddy make:database [name]    # create database
buddy make:factory [name]     # create model factory (stub)
buddy make:function [name]    # create composable function
buddy make:job [name]         # create background job
  -q/--queue [queue]          # queue name (default: 'default')
  -c/--class                  # class-based job
  -t/--tries [n]              # retry attempts (default: 3)
  -b/--backoff [n]            # backoff delay in seconds (default: 3)
buddy make:lang [name]        # create i18n language file
buddy make:migration [name]   # create database migration
buddy make:model [name]       # create data model
buddy make:notification [name]# create notification
  -e/--email                  # email notification (default: true)
  -c/--chat                   # chat notification
  -s/--sms                    # SMS notification
buddy make:policy [name]      # create authorization policy
  -m/--model [model]          # associated model
  --no-register               # skip registering in Gates.ts
buddy make:resource [name]    # create API resource
  -m/--model [model]          # associated model
  -c/--collection             # create collection resource
buddy make:queue-table        # create queue migration
buddy make:stack [name]       # create full stack
buddy make:view [name]        # create page/view (alias: make:page)
```

---

## Code Generation (generate)

### `buddy generate` - Generate artifacts

```bash
buddy generate                     # all artifacts (if no flags, runs invoke)
buddy generate -t/--types          # TypeScript types
buddy generate -e/--entries        # library entry points
buddy generate -w/--web-types      # web-types.json for IDEs
buddy generate -c/--custom-data    # VS Code custom data
buddy generate -i/--ide-helpers    # IDE helpers
buddy generate -c/--component-meta # component meta information
buddy generate -p/--pantry         # pantry config
buddy generate -o/--openapi        # OpenAPI specification
buddy generate --core-symlink      # core framework symlink

buddy generate:types               # TypeScript types (alias: types:generate)
buddy generate:entries             # library entry points
buddy generate:web-types           # web-types.json
buddy generate:vscode-custom-data  # VS Code custom data
buddy generate:ide-helpers         # IDE helpers
buddy generate:component-meta      # component meta
buddy generate:pantry-config       # pantry config
buddy generate:openapi-spec        # OpenAPI spec (alias: generate:openapi)
buddy generate:migrations          # migration diffs from models (stub)
buddy generate:core-symlink        # core symlink for core developers
```

---

## Environment Management

### `buddy env:*` - Manage environment variables

```bash
buddy env:get [key]              # get specific env var
  -f/--file [file]               # env file path (default: .env)
  --format [json|shell|eval]     # output format (default: json)
  -a/--all                       # get all env vars
  -p/--pretty                    # pretty print
buddy env:set [key] [value]      # set env var
  -f/--file [file]               # env file path
  -fk/--file-keys [path]         # keys file path
  --plain                        # don't encrypt the value
buddy env:encrypt [key]          # encrypt env var(s)
  -f/--file [file]               # env file path
  -fk/--file-keys [path]         # keys file path
  -o/--stdout                    # output to stdout
  -ek/--exclude-key [key]        # key to exclude from encryption
buddy env:decrypt [key]          # decrypt env var(s)
  -f/--file [file]               # env file path
  -fk/--file-keys [path]         # keys file path
  -o/--stdout                    # output to stdout
buddy env:keypair [key]          # generate encryption keypair
  -f/--file [file]               # env file path
  --format [json|shell]          # output format (default: json)
buddy env:rotate [key]           # rotate encryption keys
  -f/--file [file]               # env file path
  -ek/--exclude-key [key]        # key to exclude
  -o/--stdout                    # output to stdout
buddy env:check                  # validate environment configuration
  -f/--file [file]               # env file path
```

`env:check` validates: .env file exists, variable count, APP_KEY presence, encryption keys (DOTENV_PUBLIC_KEY/DOTENV_PRIVATE_KEY), .env.keys file.

---

## Cloud & Deployment

### `buddy deploy` - Deploy to cloud
Handles full deployment workflow: prerequisites check, pantry install, env setup, APP_KEY, AWS credentials (from .env.{env} or ~/.aws/credentials), domain setup, email DNS records (DKIM, MX, SPF, DMARC), mail user creation.

### `buddy cloud` - Cloud management
```bash
buddy cloud --ssh              # SSH into cloud via SSM (alias: --connect)
buddy cloud --diff             # show infrastructure changes (local vs deployed CloudFormation template)
buddy cloud --invalidate-cache # invalidate CloudFront CDN cache
  --paths [paths]              # specific paths to invalidate (default: /*)

buddy cloud:add --jump-box     # add jump box EC2 instance
buddy cloud:remove             # remove cloud infrastructure (aliases: cloud:destroy, cloud:rm, undeploy)
  --jump-box                   # remove just the jump-box
  --force                      # force deletion
  --yes                        # skip confirmation
buddy cloud:optimize-cost      # remove optional resources (jump-box)
buddy cloud:cleanup            # clean up retained resources after stack deletion
  # Cleans: jump-boxes, S3 buckets, Lambda functions, CloudWatch logs,
  # Parameter Store, VPCs, Subnets, CDK remnants, IAM users
buddy cloud:invalidate-cache   # invalidate CloudFront cache
  --paths [paths]              # paths to invalidate
buddy cloud:diff               # show deployed vs local template diff
```

`cloud:remove` uses `undeployStack()` from `storage/framework/core/actions/deploy` and handles stuck stacks by creating temporary IAM roles.

---

## Domain & DNS

### `buddy domains:*` - Domain management
```bash
buddy domains:purchase <domain>     # purchase via Route 53
  --years <n>                       # registration years (default: 1)
  --privacy                         # privacy protection (default: true)
  --auto-renew                      # auto-renew (default: true)
  --first-name/--last-name/etc.     # registrant contact (reads from config.dns.contactInfo)
  --admin-*/--tech-*                # admin/tech contact overrides
  --privacy-admin/--privacy-tech/--privacy-registrant
  --contact-type <type>             # default: 'person'
buddy domains:add <domain>          # add domain you own to cloud
buddy domains:remove <domain>       # remove domain from cloud
  --yes                             # skip confirmation
```

### `buddy dns [domain]` - DNS query tool (uses @stacksjs/dnsx)
```bash
buddy dns [domain]                  # query DNS (defaults to APP_URL)
buddy dns -q/--query <query>        # host to query
buddy dns -t/--type <type>          # record type: A, MX, NS, etc. (default: A)
buddy dns -n/--nameserver <ns>      # custom nameserver
buddy dns --class <class>           # network class: IN, CH, HS
buddy dns -U/--udp                  # DNS over UDP
buddy dns -T/--tcp                  # DNS over TCP
buddy dns -S/--tls                  # DNS over TLS
buddy dns -H/--https               # DNS over HTTPS
buddy dns -1/--short                # short mode
buddy dns -J/--json                 # JSON output
```

---

## Email / Mail Commands

### `buddy email:*` - Email management (SES/S3 based)
```bash
buddy email                  # list available email commands
buddy email:verify           # check SES domain verification, show DKIM records
buddy email:test [recipient] # send test email via SES
buddy email:list             # list configured mailboxes from config/email.ts
buddy email:logs             # view CloudWatch email processing logs
  -n/--lines <count>         # number of log lines (default: 20)
buddy email:status           # show email server deployment status via CloudFormation
buddy email:inbox [mailbox]  # view inbox emails from S3 bucket
  -n/--limit <count>         # number of emails (default: 20)
  --raw <id>                 # show raw .eml content
  --bucket <name>            # S3 bucket override
buddy email:reprocess        # reprocess raw emails from S3 into mailbox structure
  --bucket <name>            # S3 bucket override
  --prefix <prefix>          # S3 prefix (default: inbox/)
  --domain <domain>          # email domain (default: stacksjs.com)
```

Email inbox reads from S3 in two strategies:
1. `mailboxes/{domain}/{user}/inbox.json` (processed inbox)
2. Falls back to raw emails in `inbox/` or `incoming/` prefixes

### `buddy mail:*` - Mail server management
```bash
buddy mail:user:add <email>       # add mail user to DynamoDB
  --password <password>           # user password (auto-generated if not provided)
buddy mail:user:list              # list all mail users from DynamoDB
buddy mail:user:delete <email>    # delete mail user
buddy mail:proxy                  # start local IMAP proxy for Mail.app
  --port <port>                   # IMAP proxy port (default: 1993)
  --api <url>                     # mail API URL (auto-detected from CloudFormation)
buddy mail:test                   # test mail API connection
buddy mail:credentials [email]    # show SMTP credentials
buddy mail:logs                   # show mail server logs from EC2 via SSM
  -n/--lines <count>              # number of lines (default: 50)
  -f/--follow                     # follow log output (poll every 5s)
  --filter <pattern>              # filter by pattern (AUTH, LOGIN, error, etc.)
buddy mail:status                 # show mail server service/ports/memory via SSM
buddy mail:port25:request         # request port 25 unblock
  --provider <aws|hetzner>        # cloud provider (default: aws)
  --instance-id <id>              # EC2 instance ID (auto-detected)
  --elastic-ip <ip>               # Elastic IP
  --rdns <hostname>               # reverse DNS hostname
  --use-case <text>               # use case description
buddy mail:port25:status          # check outbound port 25 status
  --provider <aws|hetzner>        # cloud provider (default: aws)
buddy mail:server                 # start SMTP relay server
  --port <port>                   # SMTP port (default: 587)
```

---

## Code Quality

### `buddy lint` - Lint codebase (uses pickier)
```bash
buddy lint                   # lint project (runs pickier in lint mode)
buddy lint -f/--fix          # auto-fix lint errors
buddy lint:fix               # auto-fix (standalone command)
buddy format                 # format code
  -w/--write                 # write changes (default when no flags)
  -c/--check                 # check formatting only
buddy format:check           # check formatting without changes
```

Internal implementation: runs `bunx --bun pickier run --mode lint --config ./pickier.config.ts` (with `--fix` when requested).

### `buddy test` - Run test suite
```bash
buddy test                   # run all tests
buddy test -f/--feature      # feature tests only
buddy test -u/--unit         # unit tests only
buddy test:unit              # unit tests (standalone)
buddy test:feature           # feature tests (standalone)
buddy test:ui                # tests in browser
buddy test:types             # typecheck (alias: typecheck)
```

---

## Project Management

```bash
buddy fresh                  # reinstall dependencies
buddy install                # install deps
buddy clean                  # remove node_modules
buddy outdated               # check outdated deps
buddy add                    # add dependency

buddy upgrade                # upgrade Stacks framework (alias: update)
  -v/--version <version>     # install specific version (e.g., 0.70.23)
  --canary                   # upgrade to canary build
  --stable                   # switch to stable release
  -f/--force                 # force re-download
buddy upgrade:all            # upgrade framework + dependencies + Bun + binary
buddy upgrade:dependencies   # upgrade dependencies (alias: upgrade:deps)
buddy upgrade:bun            # upgrade Bun runtime
buddy upgrade:shell          # upgrade shell integration (Oh My Zsh)
buddy upgrade:binary         # upgrade stacks binary (requires sudo)
```

---

## Maintenance Mode

```bash
buddy down                   # put app in maintenance mode
  --message [msg]            # maintenance message
  --retry [seconds]          # retry-after header value
  --secret [token]           # bypass token (access via: your-app.com/{token})
  --allow [ip...]            # allowed IP addresses
  --redirect [url]           # redirect all requests
  --status [code]            # HTTP status code (default: 503)
buddy up                     # bring app out of maintenance mode
buddy status                 # check maintenance status (alias: maintenance:status)
```

Uses `@stacksjs/server` module's `down()`, `up()`, `isDownForMaintenance()`, `maintenancePayload()` functions.

---

## Other Commands

```bash
buddy about                  # display Stacks version, Bun/Node versions, OS, environment
buddy doctor                 # health checks (Bun version, Node, package.json, .env, APP_KEY)
buddy tinker                 # interactive REPL with Stacks preloaded
  -e/--eval [expr]           # evaluate expression and exit
  --print [expr]             # evaluate, print, and exit
  --no-banner                # skip welcome banner
  --preload [modules]        # comma-separated modules to preload
buddy key:generate           # generate and set APP_KEY
buddy commit                 # conventional commit helper (uses runCommit from @stacksjs/actions)
buddy changelog              # generate CHANGELOG.md
  -q/--quiet                 # minimal output
  -d/--dry-run               # preview without writing
buddy release                # release new version via GitHub Actions
  --dry-run                  # preview without releasing
buddy route                  # route management
buddy share [type]           # share local dev server via public tunnel (localtunnel)
  -p/--port <port>           # local port
  --server <url>             # tunnel server (default: api.localtunnel.dev)
  --subdomain <name>         # request specific subdomain
  # Supports: frontend, api, backend, admin, dashboard, desktop, docs
  # Auto-starts companion services (API, docs) for frontend shares
buddy search                 # search engine operations
buddy configure              # configure project
buddy create                 # create new project
buddy completion [shell]     # shell completion (bash/zsh/fish)
buddy ports                  # port management
  -l/--list                  # list used ports (default)
  -c/--check                 # check port availability
buddy ports:list             # list ports for project
buddy ports:check            # check ports across all Stacks projects
buddy setup                  # ensure project is set up correctly (alias: ensure)
  --skip-aws                 # skip AWS configuration
  --skip-keygen              # skip APP_KEY generation
buddy setup:ssl              # setup SSL certs + hosts file (alias: ssl:setup)
  -d/--domain [domain]       # custom domain (defaults to APP_URL)
  --skip-hosts               # skip hosts file modification
  --skip-trust               # skip certificate trust
buddy setup:oh-my-zsh        # enable Oh My Zsh integration
buddy telemetry              # telemetry management
buddy list                   # list all available commands
buddy version                # display version (flags: --version, -v)
buddy saas                   # SaaS management
buddy sms                    # SMS commands
buddy phone                  # phone commands
buddy http                   # HTTP commands
buddy auth                   # auth commands
buddy queue                  # queue management
buddy schedule               # schedule management
buddy package                # package management
buddy projects               # project management
buddy prepublish             # pre-publish checks
buddy stacks                 # Stacks framework commands (registered as 'stack' in lazy-commands)
```

---

## Adding Custom Commands

### Method 1: Commands.ts Registry (preferred)

```typescript
// app/Commands.ts
export default {
  'inspire': 'Inspire',                              // simple: maps to app/Commands/Inspire.ts
  'deploy-hooks': { file: 'DeployHooks', enabled: true, aliases: ['dh'] },  // with options
  'disabled-cmd': { file: 'Disabled', enabled: false }, // disabled command
}
```

```typescript
// app/Commands/Inspire.ts
import type { CLI } from '@stacksjs/cli'

export default function (buddy: CLI) {
  buddy
    .command('inspire', 'Display inspirational quote')
    .option('-t, --two', 'Show two quotes')
    .action(async (options: { two?: boolean }) => {
      console.log(randomQuote())
      if (options.two) console.log(randomQuote())
    })
}
```

### Method 2: Auto-discovery (fallback)
If `app/Commands.ts` does not exist, all `.ts` files in `app/Commands/` are auto-discovered and loaded. Each must export a default function that receives the CLI instance.

### Method 3: buddy.config.ts
```typescript
// buddy.config.ts
export default {
  commands: [
    (cli) => {
      cli.command('custom', 'My custom command').action(() => console.log('Hello'))
    },
  ],
  aliases: {
    'r': 'release',
    'dep': 'deploy',
  },
}
```

---

## Gotchas
- Application commands go in `app/Commands/`, framework commands in `storage/framework/core/buddy/src/commands/`
- The `buddy` file at root is a shell script that bootstraps pantry, ensures Bun is available, then runs `bun run ./storage/framework/core/buddy/src/cli.ts`
- Commands are lazy-loaded with a 5-second timeout per command to prevent startup hangs
- The `list` command loads ALL commands to display them
- When no command matches, the CLI loads only `version` for minimal overhead
- APP_KEY is auto-generated if not set (except for commands in the skipAppKeyCheck list)
- `buddy dev` with custom APP_URL starts a reverse proxy (rpx) that handles SSL certificates via `~/.stacks/ssl/`
- `dev:frontend` has aliases `dev:pages` and `dev:views`
- `dev:dashboard` has alias `dev:admin`
- `dev:system-tray` has alias `dev:tray`
- `build` with no flags defaults to building the Stacks framework (`--stacks`)
- `cloud:remove` handles stuck CloudFormation stacks by creating temporary IAM roles with AdministratorAccess
- `mail:*` commands load AWS credentials from `.env.production` and `~/.aws/credentials`
- `share` uses localtunnel and auto-starts companion dev servers (API, docs) for frontend shares
- Console listeners can be registered via `app/Listeners/Console.ts`
