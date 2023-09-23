import type { BunFile } from 'bun'

type ArrayBufferView = TypedArray | DataView

export type { Subprocess, SyncSubprocess } from 'bun'
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
export type Err = Writable

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
   * **Current Work Directory**
   *
   * Based on the `cwd` value, that's where the command...
   *
   * @default projectPath()
   */
  cwd?: string

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
  [key in ActionOption]?: boolean | number;
} & CliOptions & DomainsOptions

export type BuildOption = 'components' | 'vueComponents' | 'webComponents' | 'elements' | 'functions' | 'docs' | 'pages' | 'stacks' | 'all'
export type BuildOptions = {
  [key in BuildOption]: boolean;
} & CliOptions

export type AddOption = 'table' | 'calendar' | 'all'
export type AddOptions = {
  [key in AddOption]?: boolean;
} & CliOptions

export type CreateStringOption = 'name'
export type CreateBooleanOption = 'ui' | 'components' | 'web-components' | 'vue' | 'pages' | 'functions' | 'api' | 'database'
export type CreateOptions = {
  [key in CreateBooleanOption]: boolean
} & {
  [key in CreateStringOption]: string
} & CliOptions

export type DevOption = 'components' | 'docs' | 'pages' | 'api' | 'desktop' | 'all'
export type DevOptions = {
  [key in DevOption]: boolean;
} & CliOptions

export type GeneratorOption = 'types' | 'entries' | 'webTypes' | 'customData' | 'ideHelpers' | 'vueCompatibility' | 'componentMeta'
export type GeneratorOptions = {
  [key in GeneratorOption]?: boolean;
} & CliOptions

export type LintOption = 'fix'
export type LintOptions = {
  [key in LintOption]: boolean;
} & CliOptions

export type MakeStringOption = 'name' | 'chat' | 'sms' | 'env'
export type MakeBooleanOption = 'component' | 'page' | 'function' | 'language' | 'database' | 'migration' | 'model' | 'notification' | 'stack'
export type MakeOptions = {
  [key in MakeBooleanOption]: boolean
} & {
  [key in MakeStringOption]: string
} & CliOptions

export type UpgradeBoolean = 'framework' | 'dependencies' | 'packageManager' | 'node' | 'all' | 'force'
export type UpgradeString = 'version'

export type UpgradeOptions = {
  [key in UpgradeBoolean]: boolean;
} & {
  [key in UpgradeString]: string;
} & CliOptions

export type ExamplesString = 'version'
export type ExamplesBoolean = 'components' | 'vue' | 'webComponents' | 'elements' | 'all' | 'force'
export type ExamplesOption = ExamplesString & ExamplesBoolean | void
export type ExamplesOptions = {
  [key in ExamplesString]: string;
} & {
  [key in ExamplesBoolean]: boolean;
} & CliOptions
export type TestOptions = CliOptions & {
  showReport?: boolean
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

export interface CleanOptions extends CliOptions { }
export interface CloudOptions extends CliOptions {
  ssh?: boolean
  connect?: boolean
}
export interface CommitOptions extends CliOptions { }
export interface KeyOptions extends CliOptions { }
export interface FreshOptions extends CliOptions { }
export interface InspireOptions extends CliOptions { }
export interface InstallOptions extends CliOptions { }
export interface ReleaseOptions extends CliOptions { }
export interface PreinstallOptions extends CliOptions { }
export interface PrepublishOptions extends CliOptions { }
export interface TinkerOptions extends CliOptions { }
export interface TypesOptions extends CliOptions { }

export type LibEntryType = 'vue-components' | 'web-components' | 'functions' | 'all'

/**
 * The available npm scripts within the Stacks toolkit.
 */
export enum NpmScript {
  Build = 'build',
  BuildComponents = 'vite build --config ./core/vite/src/vue-components.ts',
  BuildWebComponents = 'build:web-components',
  BuildFunctions = 'build:functions',
  BuildDocs = 'build:docs',
  BuildStacks = 'build:stacks',
  Clean = 'rimraf bun.lockb node_modules/ .stacks/**/dist',
  Dev = 'dev',
  DevDesktop = 'dev:desktop',
  DevViews = 'dev:views',
  DevFunctions = 'dev:functions',
  Fresh = 'fresh',
  Lint = 'eslint .',
  LintFix = 'eslint . --fix',
  LintPackageJson = 'bunx publint',
  MakeStack = 'make:stack',
  Test = 'bun test',
  TestUnit = 'bun test 2',
  TestFeature = 'playwright test --config playwright.config.ts',
  TestUi = 'bun test 3',
  TestCoverage = 'bun test 4',
  TestTypes = 'vue-tsx bun --bun tsc --noEmit',
  Generate = 'generate',
  GenerateTypes = 'generate:types',
  GenerateEntries = 'generate:entries',
  GenerateVueCompat = 'generate:vue-compatibility',
  GenerateWebTypes = 'generate:web-types',
  GenerateVsCodeCustomData = 'generate:vscode-custom-data',
  GenerateIdeHelpers = 'generate:ide-helpers',
  GenerateComponentMeta = 'generate:component-meta',
  Release = 'release',
  Commit = 'commit',
  Example = 'example',
  ExampleVue = 'example:vue',
  ExampleWebComponents = 'example:web-components',
  KeyGenerate = 'key:generate',
  TypesFix = 'types:fix',
  TypesGenerate = 'types:generate',
  Preinstall = 'preinstall',
  Prepublish = 'prepublish',
  UpgradeBun = './.stacks/scripts/setup.sh +bun.sh',
  UpgradeDependencies = 'pnpm up',
}

export enum Action {
  Bump = 'bump',
  BuildStacks = 'build/stacks',
  BuildComponentLibs = 'build/component-libs',
  BuildVueComponentLib = 'build-vue-component-lib',
  BuildWebComponentLib = 'build-web-component-lib',
  BuildCli = 'build-cli',
  BuildCore = 'build/core',
  BuildDocs = 'build-docs',
  BuildFunctionLib = 'build-function-lib',
  Changelog = 'changelog',
  Clean = 'clean',
  DevComponents = 'dev/components',
  Dev = 'dev/index',
  DevDocs = 'dev/docs',
  Deploy = 'deploy/index',
  DomainsAdd = 'domains/add',
  DomainsPurchase = 'domains/purchase',
  DomainsRemove = 'domains/remove',
  Fresh = 'fresh',
  GenerateLibraryEntries = 'generate/lib-entries',
  Inspire = 'inspire',
  KeyGenerate = 'key-generate',
  MakeNotification = 'make-notification',
  Migrate = 'migrate',
  Seed = 'seed',
  Lint = 'lint/index',
  LintFix = 'lint/fix',
  Prepublish = 'prepublish',
  Release = 'release', // ✅
  ShowFeatureTestReport = 'show-feature-test-report',
  Test = 'test',
  TestUi = 'test-ui',
  TestUnit = 'test-unit',
  TestFeature = 'test-feature',
  TestCoverage = 'test-coverage',
  Tinker = 'tinker',
  Typecheck = 'typecheck',
  Upgrade = 'upgrade/index',
  UpgradeBun = 'upgrade/bun',
}

export type { CAC as CLI } from 'cac'
