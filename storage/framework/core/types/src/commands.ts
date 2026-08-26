import type { CLI } from '@stacksjs/clapp'

/**
 * Types for the commands an application defines in `app/Commands/`.
 *
 * These used to be hand-declared in every application's `app/Commands.ts`,
 * which meant each app carried its own copy of `CommandConfig` /
 * `CommandRegistry` and the framework had no way to improve them. They live
 * here now, so a command file is typed by the framework that runs it.
 *
 * `app/Commands.ts` itself is optional: every `.ts` file under `app/Commands/`
 * is discovered and registered automatically. The registry only exists for the
 * things discovery cannot infer - turning a command off, or adding an alias
 * without touching the command file.
 */

/**
 * The default export of a command file: it receives the CLI and registers one
 * or more commands on it.
 */
export type CommandFactory = (cli: CLI) => unknown

/**
 * The full shape of a command module (`app/Commands/*.ts`).
 *
 * Only `default` is required. The two optional exports are the per-file
 * equivalent of what the registry used to carry, so a command can declare them
 * next to its own code rather than in a separate file.
 */
export interface CommandModule {
  default: CommandFactory
  /** Set to `false` to keep the file on disk but out of the CLI. */
  enabled?: boolean
  /** Extra aliases for the command this file registers. */
  aliases?: string[]
}

/** A registry entry that needs more than a file name. */
export interface CommandConfig {
  /** The command file name, without the `.ts` extension, relative to `app/Commands/`. */
  file: string
  /** Whether the command is enabled. Defaults to `true`. */
  enabled?: boolean
  /** Command aliases, applied to the command the file registers. */
  aliases?: string[]
}

/**
 * The optional `app/Commands.ts` map: signature -> file name or config.
 *
 * Entries here layer configuration onto files that are discovered anyway; a
 * file that is not listed still loads.
 */
export type CommandRegistry = Record<string, string | CommandConfig>

/** A command file the loader found, after the registry (if any) is applied. */
export interface ResolvedCommand {
  /** File name relative to `app/Commands/`, without the `.ts` extension. */
  file: string
  /** Absolute path to the command file. */
  path: string
  /** The signature the registry filed it under, when it came from the registry. */
  signature?: string
  /** Aliases declared by the registry or by the module's `aliases` export. */
  aliases: string[]
  /** Whether the command should be registered on the CLI. */
  enabled: boolean
  /** Where the entry came from: disk discovery, or an `app/Commands.ts` entry. */
  source: 'auto' | 'registry'
}

/* -------------------------------------------------------------------------- */
/*  Option typing                                                             */
/* -------------------------------------------------------------------------- */

/** How a single option behaves. A bare string is shorthand for its description. */
export interface CommandOptionConfig<TDefault = unknown, TParsed = unknown> {
  description?: string
  /** The value used when the flag is absent. Its type flows into the handler. */
  default?: TDefault
  /** Value transformers, e.g. `[Number]`. Their return type flows in too. */
  type?: Array<(value: string) => TParsed>
}

/** A command's option map, keyed by raw flag (`'--dry-run, -d'`, `'--project <id>'`). */
export type CommandOptionsMap = Record<string, string | CommandOptionConfig<any, any>>

type Trim<S extends string> = S extends ` ${infer R}` ? Trim<R> : S extends `${infer R} ` ? Trim<R> : S

/** `'--project <id>'` -> `'--project'` */
type WithoutArgument<S extends string> = S extends `${infer Head} ${string}` ? Head : S

/** Picks the long flag out of `'--two, -t'` / `'-t, --two'`, falling back to the short one. */
type FlagName<S extends string> =
  S extends `${infer Head},${infer Rest}`
    ? Trim<WithoutArgument<Head>> extends `--${infer Long}`
      ? Long
      : FlagName<Trim<Rest>>
    : Trim<WithoutArgument<S>> extends `--${infer Long}`
      ? Long
      : Trim<WithoutArgument<S>> extends `-${infer Short}`
        ? Short
        : Trim<WithoutArgument<S>>

/** `--no-cache` parses into `cache: false`, so the key is the positive name. */
type Positive<S extends string> = S extends `no-${infer Name}` ? Name : S

type CamelCase<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S

/** The property name a raw flag parses into: `'--dry-run'` -> `'dryRun'`. */
export type CommandOptionKey<S extends string> = CamelCase<Positive<FlagName<S>>>

/** The value a raw flag parses into, before any declared default is considered. */
type ParsedFlagValue<S extends string> =
  S extends `${string}...${string}`
    ? string[]
    : S extends `${string}<${string}`
      ? string
      : S extends `${string}[${string}`
        ? string | true
        : boolean

/**
 * What the handler sees for one flag.
 *
 * A declared `type` wins over the shape of the flag (`type: [Number]` means a
 * number, not the raw string), and a declared `default` means the property is
 * always present.
 */
type CommandOptionValue<S extends string, TConfig> = TConfig extends { type: Array<(value: string) => infer TParsed> }
  ? TConfig extends { default: infer TDefault } ? TDefault | TParsed : TParsed | undefined
  : TConfig extends { default: infer TDefault }
    ? TDefault | ParsedFlagValue<S>
    : ParsedFlagValue<S> | undefined

/**
 * The options object a handler receives, derived from the flags it declared.
 *
 * `'--dry-run': { default: false }` becomes `dryRun: boolean`, and
 * `'--project <id>'` becomes `project: string | undefined`.
 */
export type InferCommandOptions<TOptions extends CommandOptionsMap> = {
  [K in keyof TOptions & string as CommandOptionKey<K>]: CommandOptionValue<K, TOptions[K]>
}

/** A command example, either literal text or a function of the binary name. */
export type CommandExample = string | ((bin: string) => string)

/**
 * The declarative form of a command.
 *
 * Everything the CLI needs is in one object, so the handler's `options` are
 * inferred from the flags rather than restated as a hand-written interface.
 */
export interface CommandDefinition<TOptions extends CommandOptionsMap = CommandOptionsMap> {
  /** The command signature, e.g. `'archive:run'` or `'send-emails <type>'`. */
  name: string
  description?: string
  aliases?: string[]
  options?: TOptions
  examples?: CommandExample[]
  usage?: string
  /** Accept flags the command did not declare instead of erroring. */
  allowUnknownOptions?: boolean
  /**
   * The command body. Options come first because most commands take no
   * positional arguments; any `<arg>` in `name` follows, in order.
   */
  handle: (options: InferCommandOptions<TOptions>, ...args: string[]) => unknown
}
