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
  BuildPages = 'build:pages',
  BuildDocs = 'build:docs',
  Dev = 'dev',
  DevComponents = 'dev:components',
  DevFunctions = 'dev:functions',
  DevPages = 'dev:pages',
  DevDocs = 'dev:docs',
  Fresh = 'fresh',
  Update = 'update',
}
