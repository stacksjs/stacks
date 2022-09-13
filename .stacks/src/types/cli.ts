/**
 * The parsed command-line arguments
 */
export interface StacksOptions {
  componentsSrcPath?: string
  dtsPath?: string
  extensions?: string[]
}

export const enum NpmScript {
  Build = 'build',
  BuildComponents = 'build:components',
  BuildElements = 'build:elements',
  BuildFunctions = 'build:functions',
  BuildDocs = 'build:docs',
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
  GenerateTypes = 'generate:types',
  Release = 'release',
  Commit = 'commit',
}
