/**
 * The parsed command-line arguments
 */

import type { Ora } from 'ora'

export interface StacksOptions {
  componentsSrcPath?: string
  dtsPath?: string
  extensions?: string[]
}

export interface OutroOptions {
  startTime?: number
  useSeconds?: boolean
  isError?: boolean
}

export interface IntroOptions {
  /**
   * @default true
   */
  showPerformance?: boolean
}

type SpinnerOptions = Ora

/**
 * The options to pass to the CLI.
 */
export interface CliOptions {
  /**
   * **CLI Debug Level**
   *
   * When your application is in debug mode, a different level
   * of information, like stack traces, will be shown. When
   * disabled, it defaults to the "normal experience."
   *
   * @default false
   */
  debug?: boolean

  /**
   * **Verbosity Mode**
   *
   * When your application is in verbose mode, a different level of information,
   * like useful outputs for debugging reasons, will be shown. When
   * disabled, it defaults to the "normal experience."
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
   * **Should show loading animation spinner?**
   *
   * Should the command show a loading animation?
   * Please note, when debug mode is enabled,
   * the animation will not show.
   *
   * @default true
   */
  showSpinner?: boolean | SpinnerOptions

  /**
   * **Spinner Text**
   *
   * The text to show when the spinner is shown.
   *
   * @default 'Executing...'
   */
  spinnerText?: string

  /**
   * **Should the command be run inside a shell?**
   *
   * If `true`, runs `command` inside of a shell. Uses `/bin/sh` on UNIX and `cmd.exe`
   * on Windows. A different shell can be specified as a string. The shell should
   * understand the `-c` switch on UNIX or `/d /s /c` on Windows.
   *
   * We recommend against using this option since it is:
   *  - not cross-platform, encouraging shell-specific syntax.
   *  - slower, because of the additional shell interpretation.
   *  - unsafe, potentially allowing command injection.
   *
   * @default false
   */
  shell?: boolean
}

export type { Ora as SpinnerOptions } from 'ora'

export type ActionsOption = 'types'
export type ActionsOptions = {
  [key in ActionsOption]?: boolean;
} & CliOptions

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

export type DevOption = 'components' | 'docs' | 'pages' | 'functions' | 'desktop' | 'all'
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
export type MakeBooleanOption = 'component' | 'page' | 'function' | 'language' | 'database' | 'migration' | 'factory' | 'notification' | 'stack'
export type MakeOptions = {
  [key in MakeBooleanOption]: boolean
} & {
  [key in MakeStringOption]: string
} & CliOptions

export type UpdateString = 'version'
export type UpdateBoolean = 'framework' | 'dependencies' | 'packageManager' | 'node' | 'all' | 'force'
export type UpdateOptions = {
  [key in UpdateString]: string;
} & {
  [key in UpdateBoolean]: boolean;
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

export interface CleanOptions extends CliOptions {}
export interface CommitOptions extends CliOptions {}
export interface KeyOptions extends CliOptions {}
export interface FreshOptions extends CliOptions {}
export interface InspireOptions extends CliOptions {}
export interface ReleaseOptions extends CliOptions {}
export interface PreinstallOptions extends CliOptions {}
export interface PrepublishOptions extends CliOptions {}
export interface TypesOptions extends CliOptions {}

export type LibEntryType = 'vue-components' | 'web-components' | 'functions' | 'all'

/**
 * The available npm scripts within the Stacks toolkit.
 */
export const enum NpmScript {
  Build = 'build',
  BuildComponents = 'build:components',
  BuildWebComponents = 'build:web-components',
  BuildFunctions = 'build:functions',
  BuildDocs = 'build:docs',
  BuildStacks = 'build:stacks',
  Clean = 'rimraf ./pnpm-lock.yaml ./node_modules/ ./.stacks/**/node_modules',
  Dev = 'dev',
  DevComponents = 'vite --config ./core/build/src/vue-components.ts',
  DevDocs = 'npx vitepress dev ./docs/src',
  DevDesktop = 'dev:desktop',
  DevPages = 'dev:pages',
  DevFunctions = 'dev:functions',
  Fresh = 'fresh',
  Update = 'update',
  UpdateDependencies = 'pnpm update',
  UpdateFramework = 'update:framework',
  UpdatePackageManager = 'update:package-manager',
  UpdateNode = 'pnpm env use',
  Lint = 'eslint .',
  LintFix = 'eslint . --fix',
  MakeStack = 'make:stack',
  Test = 'vitest --config vitest.config.ts',
  TestUnit = 'vitest --config vitest.config.ts',
  TestFeature = 'playwright test --config playwright.config.ts',
  TestUi = 'vitest --config vitest.config.ts --ui',
  TestCoverage = 'vitest --config vitest.config.ts --coverage',
  TestTypes = 'vue-tsc --noEmit',
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
  Wip = 'wip',
}

export const enum Action {
  Bump = 'bump', // wip - changelog action
  BuildStacks = 'build/stacks',
  BuildComponentLibs = 'build-component-libs',
  BuildVueComponentLib = 'build-vue-component-lib',
  BuildWebComponentLib = 'build-web-component-lib',
  BuildCli = 'build-cli',
  BuildCore = 'build/core', // wip
  BuildDocs = 'build-docs',
  BuildFunctionLib = 'build-function-lib',
  Changelog = 'changelog', // wip
  DevComponents = 'dev/components', // wip
  DevDocs = 'dev/docs', // wip
  Fresh = 'fresh', // wip
  GeneratePackageJsons = 'generate-package-jsons', // wip
  GenerateSettings = 'generate-settings',
  GenerateOnboarding = 'generate-onboarding',
  KeyGenerate = 'key-generate', // wip
  MakeNotification = 'make-notification', // wip
  Migrate = 'migrate', // wip
  Lint = 'lint', // wip
  LintFix = 'lint-fix', // wip
  Prepublish = 'prepublish', // wip
  Release = 'release', // wip
  Test = 'test', // wip
  TestUi = 'test-ui', // wip
  TestUnit = 'test-unit', // wip
  TestFeature = 'test-feature', // wip
  TestCoverage = 'test-coverage', // wip
  Typecheck = 'typecheck', // wip
  ShowFeatureTestReport = 'show-feature-test-report', // wip
}

export type { CAC as CLI } from 'cac'
export type { ExecaReturnValue as CommandResult } from 'execa'
