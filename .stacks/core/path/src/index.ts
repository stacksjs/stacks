import { basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath } from 'pathe'

/**
 * Returns the path to the `ai` directory. The AI directory
 * contains the core Stacks' AI logic which currently
 * is a wrapper of the OpenAI API.
 *
 * @param path - relative path to the file or directory
 * @returns string - absolute path to the file or directory
 *
 * @example
 * ```ts
 * import { aiPath } from '@stacks/paths'
 *
 * console.log('path is', aiPath())
 * // path is /Users/chrisbreuer/Code/stacks/.stacks/core/ai
 * ```
 */
export function aiPath(path?: string) {
  return corePath(`ai/${path || ''}`)
}

/**
 * Returns the path to the `actions` directory. The actions directory
 * contains the core Stacks' actions. An action
 *
 * @param path - relative path to the file or directory
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
  return corePath(`actions/src/${path || ''}`)
}

export function aliasPath() {
  return corePath('alias/src/index.ts')
}

export function runtimePath(path?: string) {
  return frameworkPath(`buddy/${path || ''}`)
}

export function arraysPath(path?: string) {
  return corePath(`arrays/${path || ''}`)
}

export function authPath(path?: string) {
  return corePath(`auth/${path || ''}`)
}

export function appPath(path?: string) {
  return projectPath(`app/${path || ''}`)
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

export function chatPath(path?: string) {
  return corePath(`chat/${path || ''}`)
}

export function cliPath(path?: string) {
  return corePath(`cli/${path || ''}`)
}

export function cloudPath(path?: string) {
  return corePath(`cloud/${path || ''}`)
}

export function collectionsPath(path?: string) {
  return corePath(`collections/${path || ''}`)
}

export function componentsPath(path?: string) {
  return resourcesPath(`components/${path || ''}`)
}

export function configPath(path?: string) {
  return corePath(`config/${path || ''}`)
}

export function userConfigPath(path?: string) {
  return projectPath(`config/${path || ''}`)
}

export function corePath(path?: string) {
  return frameworkPath(`core/${path || ''}`)
}

export function dashboardPath(path?: string) {
  return corePath(`dashboard/${path || ''}`)
}

export function databasePath(path?: string) {
  return corePath(`database/${path || ''}`)
}

export function developmentPath(path?: string) {
  return corePath(`development/${path || ''}`)
}

export function desktopPath(path?: string) {
  return corePath(`desktop/${path || ''}`)
}

export function docsPath(path?: string) {
  return corePath(`docs/${path || ''}`)
}

export function domainsPath(path?: string) {
  return corePath(`domains/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

export function emailPath(path?: string) {
  return corePath(`email/${path || ''}`)
}

export function errorHandlingPath(path?: string) {
  return corePath(`error-handling/${path || ''}`)
}

export function eventsPath(path?: string) {
  return corePath(`events/${path || ''}`)
}

export function fakerPath(path?: string) {
  return corePath(`faker/${path || ''}`)
}

export function healthPath(path?: string) {
  return corePath(`health/${path || ''}`)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
}

export function storagePath(path?: string) {
  return corePath(`storage/${path || ''}`)
}

export function functionsPath(path?: string) {
  return resourcesPath(`functions/${path || ''}`)
}

export function gitPath(path?: string) {
  return corePath(`git/${path || ''}`)
}

export function langPath(path?: string) {
  return resourcesPath(`lang/${path || ''}`)
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

export function xRayPath(path?: string) {
  return corePath(`x-ray/${path || ''}`)
}

export function modelsPath(path?: string) {
  return appPath(`models/${path || ''}`)
}

export function modulesPath(path?: string) {
  return corePath(`modules/${path || ''}`)
}

export function notificationsPath(path?: string) {
  return corePath(`notifications/${path || ''}`)
}

export function ormPath(path?: string) {
  return corePath(`orm/${path || ''}`)
}

export function objectsPath(path?: string) {
  return corePath(`objects/${path || ''}`)
}

export function onboardingPath(path?: string) {
  return projectPath(`${path || 'pages/dashboard/onboarding'}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  if (type === 'vue-components')
    return frameworkPath('components/vue/package.json')

  if (type === 'web-components')
    return frameworkPath('components/web/package.json')

  if (type === 'functions')
    return frameworkPath('functions/package.json')

  return frameworkPath(`${type}/package.json`)
}

export function pagesPath(path?: string) {
  return resourcesPath(`pages/${path || ''}`)
}

export function pathPath(path?: string) {
  return corePath(`path/${path || ''}`)
}

export function paymentsPath(path?: string) {
  return corePath(`payments/${path || ''}`)
}

export function projectPath(filePath = '') {
  let path = process.cwd()

  // simple way to determine the project path
  while (path.includes('.stacks'))
    path = resolve(path, '..')

  return resolve(path, filePath)
}

export function pushPath(path?: string) {
  return corePath(`push/${path || ''}`)
}

export function queryBuilderPath(path?: string) {
  return corePath(`query-builder/${path || ''}`)
}

export function queuePath(path?: string) {
  return corePath(`queue/${path || ''}`)
}

export function realtimePath(path?: string) {
  return corePath(`realtime/${path || ''}`)
}

export function routerPath(path?: string) {
  return corePath(`router/${path || ''}`)
}

export function searchEnginePath(path?: string) {
  return corePath(`search-engine/${path || ''}`)
}

export function settingsPath(path?: string) {
  return projectPath(`${path || 'pages/dashboard/settings'}`)
}

export function smsPath(path?: string) {
  return corePath(`sms/${path || ''}`)
}

export function schedulerPath(path?: string) {
  return corePath(`scheduler/${path || ''}`)
}

export function signalsPath(path?: string) {
  return corePath(`signals/${path || ''}`)
}

export function storesPath(path?: string) {
  return resourcesPath(`stores/${path || ''}`)
}

export function resourcesPath(path?: string) {
  return projectPath(`resources/${path || ''}`)
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

export function tablesPath(path?: string) {
  return corePath(`tables/${path || ''}`)
}

export function testingPath(path?: string) {
  return corePath(`testing/${path || ''}`)
}

export function testsPath(path?: string) {
  return frameworkPath(`tests/${path || ''}`)
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

export function validationPath(path?: string) {
  return corePath(`validation/${path || ''}`)
}

const path = {
  aiPath,
  actionsPath,
  aliasPath,
  arraysPath,
  appPath,
  authPath,
  buildEnginePath,
  buildEntriesPath,
  buildPath,
  cachePath,
  chatPath,
  cliPath,
  cloudPath,
  collectionsPath,
  componentsPath,
  configPath,
  userConfigPath,
  corePath,
  customElementsDataPath,
  databasePath,
  developmentPath,
  dashboardPath,
  desktopPath,
  docsPath,
  domainsPath,
  emailPath,
  errorHandlingPath,
  eventsPath,
  healthPath,
  examplesPath,
  fakerPath,
  frameworkPath,
  storagePath,
  functionsPath,
  gitPath,
  langPath,
  libraryEntryPath,
  lintPath,
  loggingPath,
  modulesPath,
  ormPath,
  objectsPath,
  onboardingPath,
  notificationsPath,
  packageJsonPath,
  pagesPath,
  pathPath,
  paymentsPath,
  projectPath,
  pushPath,
  queryBuilderPath,
  queuePath,
  realtimePath,
  resourcesPath,
  routerPath,
  routesPath,
  searchEnginePath,
  schedulerPath,
  settingsPath,
  smsPath,
  signalsPath,
  scriptsPath,
  securityPath,
  serverPath,
  serverlessPath,
  stacksPath,
  stringsPath,
  storesPath,
  tablesPath,
  testingPath,
  testsPath,
  typesPath,
  uiPath,
  utilsPath,
  validationPath,
  xRayPath,

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

export { path, basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath }
