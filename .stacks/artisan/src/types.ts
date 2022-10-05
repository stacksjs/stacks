/**
 * Describes a plain-text file.
 */
export interface TextFile {
  path: string
  data: string
}

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
  GenerateTypes = 'generate:types',
  generateEntries = 'generate:entries',
  generateVueCompat = 'generate:vue-compatibility',
  Release = 'release',
  Commit = 'commit',
  ExampleVue = 'example:vue',
  ExampleWebComponents = 'example:web-components',
  KeyGenerate = 'key:generate',
}

/**
 * Describes a JSON file.
 */
export interface JsonFile {
  path: string
  data: unknown
  indent: string
  newline: string | undefined
}

/**
 * The npm package manifest (package.json)
 */
export interface Manifest {
  name: string
  version: string
  description: string
  [key: string]: unknown
}
