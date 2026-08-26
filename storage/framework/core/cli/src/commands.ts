import type { CLI } from '@stacksjs/clapp'
import type {
  CommandDefinition,
  CommandFactory,
  CommandModule,
  CommandOptionConfig,
  CommandOptionsMap,
  CommandRegistry,
  InferCommandOptions,
  ResolvedCommand,
} from '@stacksjs/types'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Discovery and loading for the commands an application defines in
 * `app/Commands/`.
 *
 * Commands are found on disk. `app/Commands.ts` is optional and purely
 * additive: it names signatures, adds aliases, and can disable a file. A
 * command file that nobody registered still loads, which is what the docs
 * always claimed and what the loader now actually does.
 */

/** Files that live under `app/Commands/` without being commands. */
const NON_COMMAND = /(?:\.test|\.spec|\.bench|\.d)\.ts$/

function isCommandFile(name: string): boolean {
  return name.endsWith('.ts') && !NON_COMMAND.test(name) && !name.startsWith('_')
}

/**
 * Every command file under `dir`, as ids relative to it and without the `.ts`
 * extension (`'Inspire'`, `'Archive/Run'`), sorted for a stable help listing.
 *
 * Nested directories are walked so commands can be grouped by feature rather
 * than flattened into one directory of prefixed names.
 */
export function discoverCommandFiles(dir: string): string[] {
  if (!existsSync(dir))
    return []

  const files: string[] = []

  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules')
        continue

      if (entry.isDirectory()) {
        walk(join(current, entry.name), `${prefix}${entry.name}/`)
        continue
      }

      if (isCommandFile(entry.name))
        files.push(`${prefix}${entry.name.slice(0, -3)}`)
    }
  }

  walk(dir, '')

  return files.sort()
}

/**
 * Read the optional `app/Commands.ts` registry.
 *
 * A missing file is the normal case and returns `undefined`. A file that
 * exists but throws is a real problem the caller should hear about, so the
 * error is returned rather than swallowed - the old loader treated both the
 * same and silently fell back to discovery, which turned a syntax error in the
 * registry into "my aliases stopped working".
 */
export async function loadCommandRegistry(
  registryPath?: string,
): Promise<{ registry?: CommandRegistry, error?: unknown }> {
  if (!registryPath || !existsSync(registryPath))
    return {}

  try {
    const imported = await import(registryPath)
    const registry = imported.default

    if (!registry || typeof registry !== 'object')
      return { error: new Error(`${registryPath} must default-export a command registry object.`) }

    return { registry: registry as CommandRegistry }
  }
  catch (error) {
    return { error }
  }
}

export interface ResolveCommandsOptions {
  /** Absolute path to `app/Commands`. */
  commandsDir: string
  /** Absolute path to the optional `app/Commands.ts` registry. */
  registryPath?: string
  /** A registry already in hand, e.g. from `loadCommandRegistry`. */
  registry?: CommandRegistry
}

/**
 * The commands an application exposes: every file on disk, with registry
 * configuration layered on top.
 *
 * Registry entries come first, in declaration order, so an application can
 * still control how its commands are listed. Entries pointing at a file that
 * does not exist are dropped.
 */
export async function resolveCommands(options: ResolveCommandsOptions): Promise<ResolvedCommand[]> {
  const { commandsDir } = options
  const registry = options.registry ?? (await loadCommandRegistry(options.registryPath)).registry
  const discovered = discoverCommandFiles(commandsDir)
  const byFile = new Map<string, ResolvedCommand>()

  for (const file of discovered) {
    byFile.set(file, {
      file,
      path: join(commandsDir, `${file}.ts`),
      aliases: [],
      enabled: true,
      source: 'auto',
    })
  }

  const ordered: ResolvedCommand[] = []

  for (const [signature, entry] of Object.entries(registry ?? {})) {
    const config = typeof entry === 'string' ? { file: entry } : entry
    const resolved = byFile.get(config.file)

    if (!resolved)
      continue

    resolved.signature = signature
    resolved.aliases = config.aliases ?? []
    resolved.enabled = config.enabled !== false
    resolved.source = 'registry'

    if (!ordered.includes(resolved))
      ordered.push(resolved)
  }

  for (const file of discovered) {
    const resolved = byFile.get(file)

    if (resolved && !ordered.includes(resolved))
      ordered.push(resolved)
  }

  return ordered
}

/**
 * Attach aliases to a command the CLI already knows about.
 *
 * The signature may carry arguments (`'send-emails <type>'`) while the command
 * is named by its first word, so the lookup matches on that. Nothing is thrown
 * when no command matches: an alias for a command that was never registered is
 * a mistake worth a log line, not a reason to take the whole CLI down.
 */
export function applyAliases(cli: CLI, signature: string, aliases: string[]): boolean {
  const name = signature.trim().split(/\s+/)[0]
  const commands = (cli as any)?.commands as Array<{ name?: string, alias?: (a: string) => unknown }> | undefined
  const command = commands?.find(c => c.name === name)

  if (!command || typeof command.alias !== 'function')
    return false

  for (const alias of aliases)
    command.alias(alias)

  return true
}

export interface LoadCommandsOptions extends ResolveCommandsOptions {
  /** Reports a problem with one command without failing the whole load. */
  onError?: (message: string, error?: unknown) => void
  /** Reports skipped files and other non-problems. */
  onDebug?: (message: string) => void
}

/**
 * Register every enabled application command on `cli`.
 *
 * Returns the commands that were loaded, so a caller can report on them. One
 * broken command file never stops the others from loading.
 */
export async function loadCommands(cli: CLI, options: LoadCommandsOptions): Promise<ResolvedCommand[]> {
  const onError = options.onError ?? (() => {})
  const onDebug = options.onDebug ?? (() => {})

  if (!existsSync(options.commandsDir)) {
    onDebug(`No ${options.commandsDir} directory, skipping application commands.`)
    return []
  }

  const registryResult = options.registry
    ? { registry: options.registry }
    : await loadCommandRegistry(options.registryPath)

  if (registryResult.error)
    onError(`Could not read the command registry at ${options.registryPath}`, registryResult.error)

  const resolved = await resolveCommands({ ...options, registry: registryResult.registry })
  const loaded: ResolvedCommand[] = []

  for (const command of resolved) {
    if (!command.enabled) {
      onDebug(`Skipping disabled command ${command.file}.`)
      continue
    }

    try {
      const module = await import(command.path) as Partial<CommandModule>

      if (module.enabled === false) {
        onDebug(`Skipping ${command.file}: the module exports \`enabled = false\`.`)
        continue
      }

      if (typeof module.default !== 'function') {
        onError(`Expected a default export function in ${command.file}.ts, but got: ${typeof module.default}`)
        continue
      }

      const before = ((cli as any).commands as Array<{ name?: string }> | undefined)?.length ?? 0

      module.default(cli)

      const aliases = [...command.aliases, ...(module.aliases ?? [])]

      if (aliases.length)
        aliasNewCommands(cli, command.signature, before, aliases, onDebug)

      loaded.push(command)
    }
    catch (error) {
      onError(`Failed to load command ${command.file}`, error)
    }
  }

  return loaded
}

/**
 * Alias whatever the command file just registered.
 *
 * With a registry signature we alias that exact command. Without one - the
 * normal case now that discovery needs no registry - we alias the first
 * command the file added, which is the command the file is about.
 */
function aliasNewCommands(
  cli: CLI,
  signature: string | undefined,
  before: number,
  aliases: string[],
  onDebug: (message: string) => void,
): void {
  if (signature && applyAliases(cli, signature, aliases))
    return

  const commands = (cli as any).commands as Array<{ name?: string, alias?: (a: string) => unknown }> | undefined
  const added = commands?.slice(before) ?? []
  const target = added[0]

  if (!target || typeof target.alias !== 'function') {
    onDebug(`Could not alias '${signature ?? 'command'}': no matching command was registered.`)
    return
  }

  for (const alias of aliases)
    target.alias(alias)
}

/* -------------------------------------------------------------------------- */
/*  Authoring helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Type the default export of a command file.
 *
 * Two forms, both fully typed:
 *
 * ```ts
 * // declarative - `options` is inferred from the flags
 * export default defineCommand({
 *   name: 'archive:run',
 *   description: 'Export aged log partitions',
 *   options: {
 *     '--dry-run': { description: 'Change nothing', default: false },
 *     '--project <id>': 'Restrict the run to one project',
 *   },
 *   handle: async (options) => {
 *     options.dryRun // boolean
 *     options.project // string | undefined
 *   },
 * })
 *
 * // imperative - the CLI is typed, for commands that register several names
 * export default defineCommand((cli) => {
 *   cli.command('inspire', 'Inspire yourself').action(() => {})
 * })
 * ```
 */
export function defineCommand(factory: CommandFactory): CommandFactory
export function defineCommand<TOptions extends CommandOptionsMap>(definition: CommandDefinition<TOptions>): CommandFactory
export function defineCommand(input: CommandFactory | CommandDefinition<any>): CommandFactory {
  if (typeof input === 'function')
    return input

  return (cli: CLI) => registerDefinition(cli, input)
}

function registerDefinition<TOptions extends CommandOptionsMap>(cli: CLI, definition: CommandDefinition<TOptions>): unknown {
  const command = cli.command(definition.name, definition.description ?? '', {
    allowUnknownOptions: definition.allowUnknownOptions,
  })

  if (definition.usage)
    command.usage(definition.usage)

  for (const [flag, config] of Object.entries(definition.options ?? {})) {
    const option: CommandOptionConfig = typeof config === 'string' ? { description: config } : config

    command.option(flag, option.description ?? '', {
      ...(option.default === undefined ? {} : { default: option.default }),
      ...(option.type ? { type: option.type } : {}),
    })
  }

  for (const alias of definition.aliases ?? [])
    command.alias(alias)

  for (const example of definition.examples ?? [])
    command.example(example)

  // clapp passes positional arguments first and the parsed options last. The
  // handler takes options first, because most commands have no positional
  // arguments and having to name them to reach the flags reads badly.
  command.action((...args: any[]) => {
    const options = args[args.length - 1] as InferCommandOptions<TOptions>

    return definition.handle(options, ...args.slice(0, -1) as string[])
  })

  return command
}

/**
 * Type the optional `app/Commands.ts` registry.
 *
 * Only needed to disable a command or add an alias without editing the command
 * file - commands are discovered from `app/Commands/` either way.
 */
export function defineCommands<T extends CommandRegistry>(registry: T): T {
  return registry
}
