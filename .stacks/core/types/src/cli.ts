/**
 * The parsed command-line arguments
 */
export interface StacksOptions {
  componentsSrcPath?: string
  dtsPath?: string
  extensions?: string[]
}

/**
 * The options to pass to the CLI.
 */
export interface CliOptions {
  debug?: boolean | IOType
}

export type ActionsOption = 'types'
export type ActionsOptions = {
  [key in ActionsOption]?: boolean;
} & CliOptions

export type BuildOption = 'components' | 'vueComponents' | 'webComponents' | 'elements' | 'functions' | 'docs' | 'pages' | 'stacks' | 'all'
export type BuildOptions = {
  [key in BuildOption]: boolean;
} & CliOptions

export type DevOption = 'components' | 'docs' | 'pages' | 'functions' | 'all'
export type DevOptions = {
  [key in DevOption]: boolean;
} & CliOptions

export type ExampleOption = 'components' | 'vue' | 'webComponents' | void
export type ExampleOptions = {
  components: boolean
  vue: boolean
  webComponents: boolean
} & CliOptions

export type GeneratorOption = 'types' | 'entries' | 'webTypes' | 'customData' | 'ideHelpers' | 'vueCompatibility' | 'componentMeta'
export type GeneratorOptions = {
  [key in GeneratorOption]?: boolean;
} & CliOptions

export type LintOption = 'fix'
export type LintOptions = {
  [key in LintOption]: boolean;
} & CliOptions

export type MakeOption = 'component' | 'page' | 'function' | 'language' | 'database' | 'migration' | 'factory' | 'notification' | 'stack'
export type MakeOptions = {
  [key in MakeOption]?: boolean;
} & CliOptions

export type UpdateOption = 'framework' | 'dependencies' | 'packageManager' | 'node' | 'version' | 'all' | 'force'
export type UpdateOptions = {
  [key in UpdateOption]: boolean;
} & CliOptions

export interface TestOptions extends CliOptions {}
export interface CleanOptions extends CliOptions {}
export interface CommitOptions extends CliOptions {}

export type LibEntryType = 'vue-components' | 'web-components' | 'functions' | 'all'
export type IOType = 'ignore' | 'inherit'

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
  Clean = 'clean',
  Dev = 'dev',
  DevComponents = 'dev:components',
  DevDocs = 'dev:docs',
  DevPages = 'dev:pages',
  DevFunctions = 'dev:functions',
  Fresh = 'fresh',
  Update = 'update',
  UpdateDependencies = 'update:dependencies',
  UpdateFramework = 'update:framework',
  UpdatePackageManager = 'update:package-manager',
  UpdateNode = 'update:node',
  Lint = 'lint',
  LintFix = 'lint:fix',
  MakeStack = 'make:stack',
  Test = 'test',
  TestTypes = 'test:types',
  TestCoverage = 'test:coverage',
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

export type { CAC as CLI } from 'cac'
