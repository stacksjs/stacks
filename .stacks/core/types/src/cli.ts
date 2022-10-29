import type { CAC } from 'cac'

export type CLI = CAC

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

export interface BuildOptions extends CliOptions {
  components?: boolean
  vueComponents?: boolean
  webComponents?: boolean
  elements?: boolean
  functions?: boolean
  docs?: boolean
  pages?: boolean
  stacks?: boolean
  all?: boolean
}

export interface LintOptions extends CliOptions {
  fix?: boolean
}

export type BuildOption = 'components' | 'vue-components' | 'web-components' | 'elements' | 'functions' | 'docs' | 'pages'

export interface UpdateOptions extends CliOptions {
  framework?: boolean
  dependencies?: boolean
  packageManager?: boolean
  node?: boolean
  version?: string
  all?: boolean
  force?: boolean
}

export interface GeneratorOptions extends CliOptions {
  types?: boolean
  entries?: boolean
  webTypes?: boolean
  customData?: boolean
  ideHelpers?: string
  vueCompatibility?: boolean
  componentMeta?: boolean
}

export interface ActionsOptions extends CliOptions {
  types?: boolean
}

export interface MakeOptions extends CliOptions {
  component?: boolean
  page?: boolean
  function?: boolean
  language?: boolean
  database?: boolean
  migration?: boolean
  factory?: boolean
  notification?: boolean
  stack?: boolean
}

export type IOType = 'ignore' | 'inherit'
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
  Clean = 'clean',
  Dev = 'dev',
  DevComponents = 'dev:components',
  DevDocs = 'dev:docs',
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
