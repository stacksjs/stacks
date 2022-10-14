/**
 * The parsed command-line arguments
 */
export interface StacksOptions {
  componentsSrcPath?: string
  dtsPath?: string
  extensions?: string[]
}

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
  Dev = 'dev',
  DevComponents = 'dev:components',
  DevDocs = 'dev:docs',
  Fresh = 'fresh',
  Update = 'update',
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
  ExampleVue = 'example:vue',
  ExampleWebComponents = 'example:web-components',
  KeyGenerate = 'key:generate',
}
