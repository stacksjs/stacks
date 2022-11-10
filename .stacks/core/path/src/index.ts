import { basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath } from 'pathe'

/**
 * Returns the path to the `actions` directory. The actions directory
 * contains the core Stacks' actions. An action
 *
 * @param path string - relative path to the file or directory
 * @returns string - absolute path to the file or directory
 * @example
 * ```ts
 * import { buildPath } from '@stacks/paths'
 *
 * buildPath('functions.vue')
 * buildPath('any-path.ts')
 * ```
 */
export function actionsPath(path?: string) {
  return corePath(`actions/${path || ''}`)
}

export function aliasPath() {
  return runtimePath('alias.ts')
}

export function runtimePath(path?: string) {
  return corePath(`runtime/${path || ''}`)
}

export function arraysPath(path?: string) {
  return corePath(`arrays/${path || ''}`)
}

export function authPath(path?: string) {
  return corePath(`auth/${path || ''}`)
}

/**
 * Returns the path to the build directory. The build directory
 * contains Stacks' build engine & its tooling integrations.
 *
 * @param path string - relative path to the file or directory
 * @returns string - absolute path to the file or directory
 * @example
 * ```ts
 * buildPath('functions.vue')
 * buildPath('vue-components.ts')
 * ```
 */
export function buildPath(path?: string) {
  return corePath(`build/${path || ''}`)
}

export function buildEnginePath(path?: string) {
  return buildPath(`${path || ''}`)
}

export function buildEntriesPath(path?: string) {
  return buildPath(`entries/${path || ''}`)
}

export function cachePath(path?: string) {
  return corePath(`cache/${path || ''}`)
}

export function cliPath(path?: string) {
  return corePath(`cli/${path || ''}`)
}

export function collectionsPath(path?: string) {
  return corePath(`collections/${path || ''}`)
}

export function componentsPath(path?: string) {
  return projectPath(`components/${path || ''}`)
}

export function configPath() {
  return frameworkPath('config.ts')
}

export function corePath(path?: string) {
  return frameworkPath(`core/${path || ''}`)
}

export function docsPath(path?: string) {
  return corePath(`docs/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

export function errorsPath(path?: string) {
  return corePath(`errors/${path || ''}`)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
}

export function fsPath(path?: string) {
  return corePath(`fs/${path || ''}`)
}

export function functionsPath(path?: string) {
  return projectPath(`functions/${path || ''}`)
}

export function gitPath(path?: string) {
  return corePath(`git/${path || ''}`)
}

export function langPath(path?: string) {
  return projectPath(`lang/${path || ''}`)
}

export function libraryEntryPath(type: 'vue-components' | 'web-components' | 'functions') {
  return buildEntriesPath(`${type}.ts`)
}

export function lintPath(path?: string) {
  return corePath(`lint/${path || ''}`)
}

export function loggingPath(path?: string) {
  return corePath(`logging/${path || ''}`)
}

export function modulesPath(path?: string) {
  return corePath(`modules/${path || ''}`)
}

export function objectsPath(path?: string) {
  return corePath(`objects/${path || ''}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return frameworkPath(`./${type}/package.json`)
}

export function pagesPath(path?: string) {
  return projectPath(`pages/${path || ''}`)
}

export function pathPath(path?: string) {
  return corePath(`path/${path || ''}`)
}

export function projectPath(filePath = '') {
  let path = process.cwd()

  // workaround: simple way to determine the project path
  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (!path.includes('.stacks'))
    path = resolve(path, '.')

  return resolve(path, filePath)
}

export function routerPath(path?: string) {
  return corePath(`router/${path || ''}`)
}

export function routesPath(path?: string) {
  return projectPath(`routes/${path || ''}`)
}

export function securityPath(path?: string) {
  return corePath(`security/${path || ''}`)
}

export function serverPath(path?: string) {
  return corePath(`server/${path || ''}`)
}

export function serverlessPath(path?: string) {
  return corePath(`serverless/${path || ''}`)
}

export function stacksPath(path?: string) {
  return frameworkPath(`src/${path || ''}`)
}

export function testsPath(path?: string) {
  return corePath(`tests/${path || ''}`)
}

export function typesPath(path?: string) {
  return corePath(`types/${path || ''}`)
}

export function stringsPath(path?: string) {
  return corePath(`strings/${path || ''}`)
}

export function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

export function uiPath(path?: string) {
  return corePath(`ui/${path || ''}`)
}

export function utilsPath(path?: string) {
  return corePath(`utils/${path || ''}`)
}

export const path = {
  actionsPath,
  aliasPath,
  arraysPath,
  authPath,
  buildEnginePath,
  buildEntriesPath,
  buildPath,
  cachePath,
  cliPath,
  collectionsPath,
  componentsPath,
  configPath,
  corePath,
  customElementsDataPath,
  docsPath,
  errorsPath,
  examplesPath,
  frameworkPath,
  fsPath,
  functionsPath,
  gitPath,
  langPath,
  libraryEntryPath,
  lintPath,
  loggingPath,
  modulesPath,
  objectsPath,
  packageJsonPath,
  pagesPath,
  pathPath,
  projectPath,
  routerPath,
  routesPath,
  scriptsPath,
  securityPath,
  serverPath,
  serverlessPath,
  stacksPath,
  stringsPath,
  testsPath,
  typesPath,
  uiPath,
  utilsPath,

  // path utils
  basename,
  delimiter,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  normalizeString,
  parse,
  relative,
  resolve,
  sep,
  toNamespacedPath,
}

export { basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath }

export default path
