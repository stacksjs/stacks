/**
 * The pure half of the extension: everything that can be decided from text.
 *
 * Nothing here imports `vscode` or touches the filesystem, so it is unit-tested
 * directly. Where Stacks itself makes the same decision (the dev server's URL
 * and port in `buddy dev`, the command list in `buddy list`), the rule is
 * mirrored from that code and the source is named, so the two can be compared
 * when either one changes.
 */

/**
 * The env files a development process reads, least to most specific - the
 * order `autoLoadEnv()` in `@stacksjs/env` (core/env/src/plugin.ts) loads them
 * in when no environment is set, which is what `./buddy dev` runs under.
 */
export const DEV_ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'] as const

/** The dev server's frontend port when `PORT` is unset (`buddy dev`). */
export const DEFAULT_FRONTEND_PORT = 3000

/** `buddy dev` falls back to this when `APP_URL` is unset. */
export const DEFAULT_APP_URL = 'stacks.localhost'

export type Env = Record<string, string | undefined>

/**
 * Parse a dotenv file into key/value pairs.
 *
 * Covers what Stacks' own `.env` files use: `KEY=value`, an optional `export`
 * prefix, single/double/backtick quotes, and `#` comments (whole-line, or
 * trailing after whitespace on an unquoted value). Multi-line values are not
 * needed for anything this extension reads, so they are not supported.
 */
export function parseEnvFile(source: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue

    const match = line.match(/^(?:export\s+)?([A-Z_a-z][\w.-]*)\s*=\s*(.*)$/)
    if (!match)
      continue

    const key = match[1] as string
    let value = (match[2] as string).trim()
    const quote = value[0]

    if (quote === '"' || quote === '\'' || quote === '`') {
      const end = value.indexOf(quote, 1)
      value = end === -1 ? value.slice(1) : value.slice(1, end)
    }
    else {
      const comment = value.search(/\s#/)
      if (comment !== -1)
        value = value.slice(0, comment).trim()
    }

    result[key] = value
  }

  return result
}

/**
 * Merge the development env files of a project, later files winning.
 *
 * `read` returns a file's contents, or `undefined` when it does not exist.
 * Ciphertext (`encrypted:...`) goes through `decrypt`, which the extension
 * builds from `@stacksjs/env`'s own decryption and the project's keys
 * (./env.ts), so an encrypted `APP_URL` or `PORT` previews the same URL
 * `buddy dev` serves. Without `decrypt`, or when it cannot decrypt a value
 * (no key), the value is skipped: a ciphertext `PORT` would only produce a
 * nonsense URL. Decrypted values stay in this object, in memory.
 */
export function loadProjectEnv(
  read: (file: string) => string | undefined,
  files: readonly string[] = DEV_ENV_FILES,
  decrypt?: (file: string, value: string) => string | undefined,
): Record<string, string> {
  const env: Record<string, string> = {}

  for (const file of files) {
    const source = read(file)
    if (source === undefined)
      continue

    for (const [key, value] of Object.entries(parseEnvFile(source))) {
      if (!value.startsWith('encrypted:')) {
        env[key] = value
        continue
      }

      const plaintext = decrypt?.(file, value)
      if (plaintext !== undefined)
        env[key] = plaintext
    }
  }

  return env
}

/**
 * The pretty domain `buddy dev` serves the app on, or `null` for plain
 * localhost. Mirrors `resolvePrettyDevDomain()` in core/buddy/src/commands/dev.ts.
 */
export function resolvePrettyDomain(appUrl: string | undefined): string | null {
  if (!appUrl)
    return null

  try {
    const url = new URL(/^https?:\/\//i.test(appUrl) ? appUrl : `https://${appUrl}`)
    const hostname = url.hostname.toLowerCase()
    if (isLoopbackHost(hostname))
      return null

    return hostname
  }
  catch {
    return null
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0'
}

/** Whether a URL points at this machine, so it may need port forwarding when remote. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname)
  }
  catch {
    return false
  }
}

/**
 * Normalize an entry path to `/path?query#hash`. Mirrors
 * `normalizeDevelopmentEntryPath()` in core/buddy/src/commands/dev.ts.
 */
export function normalizeEntryPath(path: string | undefined): string {
  const value = path?.trim()
  if (!value || value === '/')
    return '/'

  try {
    const parsed = new URL(value, 'http://stacks.localhost')
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  catch {
    return '/'
  }
}

/**
 * The application path a project configured explicitly: `APP_PATH`, else
 * `appPath` in `config/app.ts` - the same two places, read the same way, as
 * `configuredApplicationPath()` in core/buddy/src/commands/dev.ts.
 *
 * `buddy dev` additionally guesses an entry page from the views it finds. The
 * extension does not repeat that guess: when it started the dev server itself,
 * it reads the exact URL from the banner instead (`parseDevBannerUrl`).
 */
export function configuredAppPath(env: Env, appConfigSource?: string): string {
  if (env.APP_PATH)
    return normalizeEntryPath(env.APP_PATH)

  const fromConfig = appConfigSource?.match(/^[ \t]*appPath\s*:\s*(['"`])([^'"`]+)\1/m)?.[2]
  return normalizeEntryPath(fromConfig)
}

/** Join a base URL and an entry path. Mirrors `developmentUrl()` in dev.ts. */
export function developmentUrl(baseUrl: string, entryPath: string): string {
  const normalized = normalizeEntryPath(entryPath)
  if (normalized === '/')
    return baseUrl.replace(/\/$/, '')

  return new URL(normalized, `${baseUrl.replace(/\/$/, '')}/`).toString()
}

export interface Endpoint {
  host: string
  port: number
}

export interface PreviewCandidate extends Endpoint {
  url: string
}

export interface PreviewPlan {
  /** The frontend dev server itself. If this is not listening, nothing is running. */
  server: Endpoint
  /** URLs to open, best first. The last one is always the plain localhost URL. */
  candidates: PreviewCandidate[]
}

/**
 * Work out where the running dev server can be reached, the way `buddy dev`
 * decides it (core/buddy/src/commands/dev.ts, `startDevelopmentServer`):
 *
 * - the frontend binds `PORT`, else 3000;
 * - a non-loopback `APP_URL` (default `stacks.localhost`) is served as
 *   `https://<domain>` through the rpx proxy on :443, unless
 *   `STACKS_DEV_LOCALHOST=1` opts out;
 * - otherwise the app is at `http://localhost:<port>`.
 *
 * Whether the proxy actually came up is only known at runtime, so the pretty
 * URL is a candidate to probe, with localhost behind it.
 */
export function planPreview(input: { env: Env, appConfigSource?: string, preferLocalhost?: boolean }): PreviewPlan {
  const { env } = input
  const port = Number(env.PORT) || DEFAULT_FRONTEND_PORT
  const entryPath = configuredAppPath(env, input.appConfigSource)
  const local: PreviewCandidate = {
    url: developmentUrl(`http://localhost:${port}`, entryPath),
    host: 'localhost',
    port,
  }

  const localhostOnly = input.preferLocalhost === true || env.STACKS_DEV_LOCALHOST === '1'
  const domain = localhostOnly ? null : resolvePrettyDomain(env.APP_URL ?? DEFAULT_APP_URL)
  const candidates = domain
    ? [{ url: developmentUrl(`https://${domain}`, entryPath), host: domain, port: 443 }, local]
    : [local]

  return { server: { host: local.host, port }, candidates }
}

/** Resolves whether something accepts TCP connections on `host:port`. */
export type Probe = (host: string, port: number) => Promise<boolean>

/**
 * The URL to preview, or `undefined` when the dev server is not listening.
 *
 * The frontend port is the readiness signal, not the proxy: the rpx daemon on
 * :443 is shared between projects, so it can answer while this project's dev
 * server is down. Once the frontend answers, the first candidate whose
 * endpoint accepts connections wins.
 */
export async function choosePreviewUrl(plan: PreviewPlan, probe: Probe): Promise<string | undefined> {
  if (!await probe(plan.server.host, plan.server.port))
    return undefined

  for (const candidate of plan.candidates) {
    const isServer = candidate.host === plan.server.host && candidate.port === plan.server.port
    if (isServer || await probe(candidate.host, candidate.port))
      return candidate.url
  }

  return undefined
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '')
}

/**
 * The app URL from `buddy dev`'s ready banner, e.g. `  ➜  App     :    https://stacks.localhost/dashboard`.
 *
 * This is the exact URL the dev server settled on - after port shifts, the
 * proxy check and the entry-page guess - so it beats anything `planPreview`
 * can infer from configuration.
 */
export function parseDevBannerUrl(output: string): string | undefined {
  for (const line of stripAnsi(output).split(/\r?\n/)) {
    const match = line.match(/➜\s+(?:App|Site)\s*:\s*(https?:\/\/\S+)/)
    if (match)
      return match[1]
  }

  return undefined
}

export interface BuddyCommandArgument {
  name: string
  required: boolean
  variadic: boolean
}

export interface BuddyCommand {
  name: string
  description: string
  usage?: string
  arguments: BuddyCommandArgument[]
}

/** `make:model`, `dev`, `env:get`, `test:types` - the shape of a buddy command name. */
const COMMAND_NAME = /^[a-z][\w-]*(?::[\w-]+)*$/i

export function isBuddyCommandName(name: string): boolean {
  return COMMAND_NAME.test(name)
}

/**
 * Parse `./buddy list --json`. Returns `undefined` when the output is not the
 * JSON inventory (an older buddy without `--json`, or a crash), so the caller
 * can fall back to the text listing.
 *
 * Anything printed before the JSON (the env loader's status line, say) is skipped.
 */
export function parseBuddyListJson(output: string): BuddyCommand[] | undefined {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start === -1 || end <= start)
    return undefined

  let data: unknown
  try {
    data = JSON.parse(output.slice(start, end + 1))
  }
  catch {
    return undefined
  }

  const commands = (data as { commands?: unknown })?.commands
  if (!Array.isArray(commands))
    return undefined

  const result: BuddyCommand[] = []
  for (const entry of commands as Array<Record<string, unknown>>) {
    const name = entry?.name
    if (typeof name !== 'string' || !isBuddyCommandName(name))
      continue

    const args = Array.isArray(entry.arguments) ? entry.arguments as Array<Record<string, unknown>> : []
    result.push({
      name,
      description: typeof entry.description === 'string' ? entry.description : '',
      usage: typeof entry.usage === 'string' ? entry.usage.replace(/^\$\s*/, '') : undefined,
      arguments: args
        .filter(argument => typeof argument?.name === 'string')
        .map(argument => ({
          name: argument.name as string,
          required: argument.required === true,
          variadic: argument.variadic === true,
        })),
    })
  }

  return sortCommands(result)
}

/**
 * Parse the text `./buddy list` prints:
 *
 * ```text
 * Available Commands:
 *
 * Development:
 *   dev                  Start development server
 *
 * make:
 *   make:model           Create a new Model
 *
 * Total: 338 commands
 * ```
 *
 * Commands are the indented lines; group headings and the total are not.
 * The text form carries no argument information.
 */
export function parseBuddyListText(output: string): BuddyCommand[] {
  const seen = new Set<string>()
  const result: BuddyCommand[] = []

  for (const line of stripAnsi(output).split(/\r?\n/)) {
    const match = line.match(/^ {2,4}(\S+)(?:\s+(\S.*))?$/)
    const name = match?.[1]
    if (!name || !isBuddyCommandName(name) || seen.has(name))
      continue

    seen.add(name)
    result.push({ name, description: match[2]?.trim() ?? '', arguments: [] })
  }

  return sortCommands(result)
}

/** JSON inventory when the output is one, the text listing otherwise. */
export function parseBuddyList(output: string): BuddyCommand[] {
  return parseBuddyListJson(output) ?? parseBuddyListText(output)
}

function sortCommands(commands: BuddyCommand[]): BuddyCommand[] {
  return commands.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The project's own CLI, relative to the workspace root. Never `buddy` off the
 * PATH or from `node_modules/.bin`: there, `buddy` may well be the dependency
 * bot (`@buddysh/buddy`), a different program that happens to share the name.
 */
export const BUDDY = './buddy'

/** `./buddy <name> <args>`. Throws on a name that is not a buddy command. */
export function buddyCommandLine(name: string, args: string | readonly string[] = ''): string {
  if (!isBuddyCommandName(name))
    throw new Error(`Not a buddy command name: ${JSON.stringify(name)}`)

  const rest = (typeof args === 'string' ? args : args.join(' ')).trim()
  return rest ? `${BUDDY} ${name} ${rest}` : `${BUDDY} ${name}`
}

/**
 * A command line from free text typed into the picker, e.g. `migrate --diff`.
 * A leading `buddy`, `./buddy`, `bud` or `stacks` is dropped so pasting a
 * command from the docs still runs the project's own `./buddy`.
 */
export function freeTextCommandLine(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed)
    return undefined

  const rest = trimmed.replace(/^(?:\.\/)?(?:buddy|bud|stacks)(?=\s|$)/, '').trim()
  return rest ? `${BUDDY} ${rest}` : BUDDY
}

/** Placeholder text for a command's positional arguments, e.g. `<name> [type]`. */
export function argumentHint(command: BuddyCommand): string {
  return command.arguments
    .map((argument) => {
      const name = argument.variadic ? `${argument.name}...` : argument.name
      return argument.required ? `<${name}>` : `[${name}]`
    })
    .join(' ')
}

export function requiresArguments(command: BuddyCommand): boolean {
  return command.arguments.some(argument => argument.required)
}

/**
 * Which workspace folder is the Stacks project: the preferred one (the active
 * editor's) when it qualifies, else the first that does.
 */
export function pickProjectRoot(
  folders: readonly string[],
  preferred: string | undefined,
  isProject: (folder: string) => boolean,
): string | undefined {
  if (preferred && folders.includes(preferred) && isProject(preferred))
    return preferred

  return folders.find(folder => isProject(folder))
}
