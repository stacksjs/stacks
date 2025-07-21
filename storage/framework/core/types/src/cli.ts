import type { BunFile } from 'bun'
import type { Ports } from './ports'

type ArrayBufferView = NodeJS.TypedArray | DataView

export type { ErrorLike, SpawnOptions, Subprocess, SyncSubprocess } from 'bun'
export type Readable =
  | 'pipe'
  | 'inherit'
  | 'ignore'
  | null // equivalent to 'ignore'
  | undefined // to use default
  | BunFile
  | ArrayBufferView
  | number

export type Writable =
  | 'pipe'
  | 'inherit'
  | 'ignore'
  | null // equivalent to 'ignore'
  | undefined // to use default
  | BunFile
  | ArrayBufferView
  | number
  | ReadableStream
  | Blob
  | Response
  | Request

export type In = Readable
export type Out = Writable
// export type Err = Writable // TODO: find a workaround for this to not clash with our other Err export

/**
 * The file descriptor for the standard input. It may be:
 *
 * - `"ignore"`, `null`, `undefined`: The process will have no standard input
 * - `"pipe"`: The process will have a new {@link FileSink} for standard input
 * - `"inherit"`: The process will inherit the standard input of the current process
 * - `ArrayBufferView`, `Blob`: The process will read from the buffer
 * - `number`: The process will read from the file descriptor
 *
 * @default "ignore"
 */
export type stdin = 'ignore' | 'inherit' | 'pipe' | ArrayBufferView | number | null | undefined

/**
 * The file descriptor for the standard output. It may be:
 *
 * - `"pipe"`, `undefined`: The process will have a {@link ReadableStream} for standard output/error
 * - `"ignore"`, `null`: The process will have no standard output/error
 * - `"inherit"`: The process will inherit the standard output/error of the current process
 * - `ArrayBufferView`: The process write to the preallocated buffer. Not implemented.
 * - `number`: The process will write to the file descriptor
 *
 * @default "pipe"
 */
export type stdout = 'ignore' | 'inherit' | 'pipe' | ArrayBufferView | number

/**
 * The file descriptor for the standard error. It may be:
 *
 * - `"pipe"`, `undefined`: The process will have a {@link ReadableStream} for standard output/error
 * - `"ignore"`, `null`: The process will have no standard output/error
 * - `"inherit"`: The process will inherit the standard output/error of the current process
 * - `ArrayBufferView`: The process write to the preallocated buffer. Not implemented.
 * - `number`: The process will write to the file descriptor
 *
 * @default "inherit" for `spawn`
 * "pipe" for `spawnSync`
 */
export type stderr = 'ignore' | 'inherit' | 'pipe' | ArrayBufferView | number

export interface OutroOptions extends CliOptions {
  type?: 'success' | 'error' | 'warning' | 'info'
  startTime?: number
  useSeconds?: boolean
  quiet?: boolean
  message?: string
}

export interface IntroOptions {
  /**
   * @default true
   */
  showPerformance?: boolean

  /**
   * @default false
   */
  quiet: boolean
}

// type SpinnerOptions = Ora

export type CliOptionsKeys = keyof CliOptions

/**
 * The options to pass to the CLI.
 */
export interface CliOptions {
  /**
   * **Verbose Output**
   *
   * When your application is in "verbose"-mode, a different level of,
   * information like useful outputs for debugging reasons, will be
   * shown. When disabled, it defaults to the "normal experience."
   *
   * @default false
   */
  verbose?: boolean

  /**
   * **Silent Mode**
   *
   * When you are using "silent"-mode, the CLI will not output anything
   * to the console. This is useful when you want to run the CLI in
   * the background.
   *
   * @default false
   */
  silent?: boolean

  /**
   * **Quiet Mode**
   *
   * When you are using "quiet"-mode, the CLI will output minimally
   * to the console.
   *
   * @default false
   */
  quiet?: boolean

  /**
   * **Current Work Directory**
   *
   * Based on the `cwd` value, that's where the command...
   *
   * @default projectPath()
   */
  cwd?: string

  stdio?: [In, Out, Out]

  /**
   * **stdio**
   *
   * The `stdio` option lets you configure the standard I/O of the spawned process.
   *
   */
  // stdio?: [SpawnOptions.Writable, SpawnOptions.Readable, SpawnOptions.Readable]

  /**
   * @default 'pipe'
   */
  stdin?: stdin

  /**
   * @default 'pipe'
   */
  stdout?: stdout

  /**
   * @default 'inherit'
   */
  stderr?: stderr

  env?: Record<string, string | undefined>

  /**
   * Runs the action in interactive/detached mode.
   * @default false
   */
  background?: boolean

  startTime?: number

  /**
   * Include the localhost URL in the output.
   * @default false
   */
  withLocalhost?: boolean

  input?: string | ArrayBufferView | ReadableStream | Blob | Response | Request

  project?: string // TODO: can create an action that automates creating a type for this
}

export type CliConfig = CliOptions

// export type { Ora as SpinnerOptions } from 'ora'

// the `domains` option is only available for the `deploy` command
// the `count` option is only available for the `seed` command
export type ActionOption = 'types' | 'domains' | 'count'

/**
 * The options to pass to the Action.
 */
export type ActionOptions = {
  types?: boolean
  domains?: boolean
  count?: number
  dryRun?: boolean // used in buddy release
} & CliOptions &
DomainsOptions

export type BuildOption =
  | 'components'
  | 'vueComponents'
  | 'webComponents'
  | 'elements'
  | 'functions'
  | 'docs'
  | 'views'
  | 'stacks'
  | 'all'
  | 'buddy'
  | 'server'
export type BuildOptions = {
  [key in BuildOption]: boolean
} & CliOptions

export type AddOption = 'table' | 'calendar' | 'all'
export type AddOptions = {
  [key in AddOption]?: boolean
} & CliOptions

export type CreateStringOption = 'name'
export type CreateBooleanOption =
  | 'ui'
  | 'components'
  | 'web-components'
  | 'vue'
  | 'views'
  | 'functions'
  | 'api'
  | 'database'
export type CreateOptions = {
  [key in CreateBooleanOption]: boolean
} & {
  [key in CreateStringOption]: string
} & CliOptions

export type DevOption =
  | 'components'
  | 'docs'
  | 'frontend'
  | 'api'
  | 'desktop'
  | 'all'
  | 'email'
  | 'system-tray'
  | 'interactive'
  | 'verbose'
export type DevOptions = {
  [key in DevOption]: boolean
} & CliOptions

export type GeneratorOption =
  | 'types'
  | 'entries'
  | 'webTypes'
  | 'customData'
  | 'ideHelpers'
  | 'componentMeta'
  | 'coreSymlink'
  | 'openApiSpec'
  | 'pkgxConfig'
  | 'openapi'
  | 'modelFiles'
export type GeneratorOptions = {
  [key in GeneratorOption]?: boolean
} & CliOptions

export type LintOption = 'fix'
export type LintOptions = {
  [key in LintOption]: boolean
} & CliOptions

export type MakeStringOption = 'name' | 'chat' | 'sms' | 'env'
export type MakeBooleanOption =
  | 'component'
  | 'page'
  | 'function'
  | 'language'
  | 'database'
  | 'migration'
  | 'model'
  | 'notification'
  | 'stack'
  | 'middleware'
export type MakeOptions = {
  [key in MakeBooleanOption]: boolean
} & {
  [key in MakeStringOption]: string
} & CliOptions

export type UpgradeBoolean = 'framework' | 'dependencies' | 'bun' | 'shell' | 'binary' | 'all' | 'force'

export type UpgradeString = 'version'

export type UpgradeOptions = {
  [key in UpgradeBoolean]: boolean
} & {
  [key in UpgradeString]: string
} & CliOptions

export type ExamplesString = 'version'
export type ExamplesBoolean = 'components' | 'vue' | 'webComponents' | 'elements' | 'all' | 'force'
export type ExamplesOption = ExamplesString & ExamplesBoolean
export type ExamplesOptions = {
  [key in ExamplesString]: string
} & {
  [key in ExamplesBoolean]: boolean
} & CliOptions
export type TestingOptions = CliOptions & {
  ui?: boolean
  feature?: boolean
  unit?: boolean
}
export type DomainsOptions = CliOptions & {
  domain?: string
  yes?: boolean
  years?: number
  privacy?: boolean
  autoRenew?: boolean
  registrantFirstName?: string
  registrantLastName?: string
  registrantOrganization?: string
  registrantAddress?: string
  registrantCity?: string
  registrantState?: string
  registrantCountry?: string
  registrantZip?: string
  registrantPhone?: string
  registrantEmail?: string
  adminFirstName?: string
  adminLastName?: string
  adminOrganization?: string
  adminAddress?: string
  adminCity?: string
  adminState?: string
  adminCountry?: string
  adminZip?: string
  adminPhone?: string
  adminEmail?: string
  techFirstName?: string
  techLastName?: string
  techOrganization?: string
  techAddress?: string
  techCity?: string
  techState?: string
  techCountry?: string
  techZip?: string
  techPhone?: string
  techEmail?: string
  privacyAdmin?: boolean
  privacyTech?: boolean
  privacyRegistrant?: boolean
  contactType?: string
}

export interface CleanOptions extends CliOptions {}

export interface CloudCliOptions extends CliOptions {
  ssh?: boolean
  connect?: boolean
  jumpBox?: boolean
  invalidateCache?: boolean
  paths?: string
  diff?: boolean
}
export interface CommitOptions extends CliOptions {}
export interface FreshOptions extends CliOptions {
  dryRun?: boolean
  quiet?: boolean
}

export interface InspireOptions extends CliOptions {}
export interface InstallOptions extends CliOptions {}

export interface KeyOptions extends CliOptions {}

export interface MigrateOptions extends CliOptions {
  diff?: boolean
}

export interface CliQueueOptions extends CliOptions {
  queue?: string
}

export interface ReleaseOptions extends CliOptions {
  dryRun?: boolean
}
export interface ProjectsOptions extends CliOptions {
  list?: boolean
}
export interface PreinstallOptions extends CliOptions {}
export interface PrepublishOptions extends CliOptions {}
export interface PortsOptions extends CliOptions {
  ports?: Partial<Ports>
}

export interface SaasOptions extends CliOptions {}

export interface SearchCommandOptions extends CliOptions {
  model: string
  settings: boolean
  flush: boolean
}

export interface ScheduleOptions extends CliOptions {}

export interface TinkerOptions extends CliOptions {}
export interface TypesOptions extends CliOptions {}

export type LibEntryType = 'vue-components' | 'web-components' | 'functions' | 'all'

export type { CAC as CLI } from 'cac'
