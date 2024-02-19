import process from 'node:process'
import { basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath } from 'pathe'

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
 * buildPath('functions.stx')
 * buildPath('any-path.ts')
 * ```
 */
export function actionsPath(path?: string) {
  return corePath(`actions/src/${path || ''}`)
}

export function relativeActionsPath(path?: string) {
  return relative(projectPath(), actionsPath(path))
}

export function userActionsPath(path?: string) {
  return appPath(`Actions/${path || ''}`)
}

export function userJobsPath(path?: string) {
  return appPath(`Jobs/${path || ''}`)
}

export function userListenersPath(path?: string) {
  return appPath(`Listeners/${path || ''}`)
}

export function userMiddlewarePath(path?: string) {
  return appPath(`Middleware/${path || ''}`)
}

export function userModelsPath(path?: string) {
  return appPath(`Models/${path || ''}`)
}

export function userNotificationsPath(path?: string) {
  return appPath(`Notifications/${path || ''}`)
}

export function userEventsPath() {
  return appPath(`Events.ts`)
}

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
 * // path is /Users/chrisbreuer/Code/stacks/storage/stacks/src/ai
 * ```
 */
export function aiPath(path?: string) {
  return corePath(`ai/${path || ''}`)
}

export function assetsPath(path?: string) {
  return resourcesPath(`assets/${path || ''}`)
}

export function aliasPath() {
  return corePath('alias/src/index.ts')
}

export function buddyPath(path?: string, options?: { relative?: boolean }) {
  const absolutePath = corePath(`buddy/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

export function runtimePath(path?: string) {
  return frameworkPath(`buddy/${path || ''}`)
}

export function analyticsPath(path?: string) {
  return corePath(`analytics/${path || ''}`)
}

export function arraysPath(path?: string) {
  return corePath(`arrays/${path || ''}`)
}

export function appPath(path?: string) {
  return projectPath(`app/${path || ''}`)
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
 * buildPath('functions.stx')
 * buildPath('components.ts')
 * ```
 */
export function buildPath(path?: string) {
  return corePath(`build/${path || ''}`)
}

export function buildEnginePath(path?: string) {
  return buildPath(`${path || ''}`)
}

export function libsPath(path?: string) {
  return frameworkPath(`libs/${path || ''}`)
}

export function libsEntriesPath(path?: string) {
  return libsPath(`entries/${path || ''}`)
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

export function frameworkCloudPath(path?: string) {
  return frameworkPath(`cloud/${path || ''}`)
}

export function collectionsPath(path?: string) {
  return corePath(`collections/${path || ''}`)
}

export function commandsPath(path?: string) {
  return appPath(`Commands/${path || ''}`)
}

export function componentsPath(path?: string) {
  return resourcesPath(`components/${path || ''}`)
}

export function configPath(path?: string) {
  return corePath(`config/${path || ''}`)
}

export function corePath(path?: string) {
  return frameworkPath(`core/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('core/custom-elements.json')
}

export function databasePath(path?: string) {
  return corePath(`database/${path || ''}`)
}

export function datetimePath(path?: string) {
  return corePath(`datetime/${path || ''}`)
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

export function dnsPath(path?: string) {
  return corePath(`domains/${path || ''}`)
}

export function emailPath(path?: string) {
  return notificationsPath(`email/${path || ''}`)
}

export function enumsPath(path?: string) {
  return corePath(`enums/${path || ''}`)
}

export function errorHandlingPath(path?: string) {
  return corePath(`error-handling/${path || ''}`)
}

export function eventsPath(path?: string) {
  return corePath(`events/${path || ''}`)
}

export function coreEnvPath(path?: string) {
  return corePath(`env/${path || ''}`)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function fakerPath(path?: string) {
  return corePath(`faker/${path || ''}`)
}

export function frameworkPath(path?: string, options?: { relative?: boolean, cwd?: string }) {
  const absolutePath = projectStoragePath(`framework/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}

export function healthPath(path?: string) {
  return corePath(`health/${path || ''}`)
}

export function functionsPath(path?: string) {
  return resourcesPath(`functions/${path || ''}`)
}

export function gitPath(path?: string) {
  return corePath(`git/${path || ''}`)
}

export function langPath(path?: string) {
  return projectPath(`lang/${path || ''}`)
}

export function layoutsPath(path?: string, options?: { relative?: boolean }) {
  const absolutePath = resourcesPath(`layouts/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

export type LibraryType = 'vue-components' | 'web-components' | 'functions'
export function libraryEntryPath(type: LibraryType) {
  return libsEntriesPath(`${type}.ts`)
}

export function lintPath(path?: string) {
  return corePath(`lint/${path || ''}`)
}

export function listenersPath(path?: string) {
  return appPath(`Listeners/${path || ''}`)
}

export function eslintPath(path?: string) {
  return lintPath(`eslint/${path || ''}`)
}

export function jobsPath(path?: string) {
  return appPath(`Jobs/${path || ''}`)
}

export function loggingPath(path?: string) {
  return corePath(`logging/${path || ''}`)
}

export function logsPath(path?: string) {
  return projectStoragePath(`logs/${path || ''}`)
}

export function modelsPath(path?: string) {
  return appPath(`models/${path || ''}`)
}

export function modulesPath(path?: string) {
  return resourcesPath(`modules/${path || ''}`)
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
  return projectPath(`${path || 'views/dashboard/onboarding'}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  if (type === 'vue-components')
    return frameworkPath('libs/components/vue/package.json')

  if (type === 'web-components')
    return frameworkPath('libs/components/web/package.json')

  return frameworkPath(`libs/${type}/package.json`)
}

export function viewsPath(path?: string) {
  return resourcesPath(`views/${path || ''}`)
}

export function pathPath(path?: string) {
  return corePath(`path/${path || ''}`)
}

export function paymentsPath(path?: string) {
  return corePath(`payments/${path || ''}`)
}

// all paths ultimately build on the projectPath
export function projectPath(filePath = '') {
  let path = process.cwd()

  // need to also account for this being called in the ./storage/framework folder
  while (path.includes('storage'))
    path = resolve(path, '..')

  return resolve(path, filePath)
}

export function projectConfigPath(path?: string) {
  return projectPath(`config/${path || ''}`)
}

export function projectStoragePath(path?: string): string {
  return projectPath(`storage/${path || ''}`)
}

export function publicPath(path?: string) {
  return projectPath(`public/${path || ''}`)
}

export function pushPath(path?: string) {
  return notificationsPath(`push/${path || ''}`)
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

export function resourcesPath(path?: string, options?: { relative?: boolean }) {
  const absolutePath = projectStoragePath(`resources/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return projectPath(`resources/${path || ''}`)
}

export function replPath(path?: string) {
  return corePath(`repl/${path || ''}`)
}

export function routerPath(path?: string) {
  return corePath(`router/${path || ''}`)
}

export function routesPath(path?: string, options?: { relative?: boolean }) {
  const absolutePath = resourcesPath(`routes/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return projectPath(`routes/${path || ''}`)
}

export function searchEnginePath(path?: string) {
  return corePath(`search-engine/${path || ''}`)
}

export function settingsPath(path?: string) {
  return projectPath(`${path || 'views/dashboard/settings'}`)
}

export function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

export function schedulerPath(path?: string) {
  return corePath(`scheduler/${path || ''}`)
}

export function signalsPath(path?: string) {
  return corePath(`signals/${path || ''}`)
}

export function slugPath(path?: string) {
  return corePath(`slug/${path || ''}`)
}

export function smsPath(path?: string) {
  return notificationsPath(`sms/${path || ''}`)
}

export function storagePath(path?: string) {
  return corePath(`storage/${path || ''}`)
}

export function storesPath(path?: string) {
  return resourcesPath(`stores/${path || ''}`)
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

export function stringsPath(path?: string) {
  return corePath(`strings/${path || ''}`)
}

export function testingPath(path?: string) {
  return corePath(`testing/${path || ''}`)
}

export function tinkerPath(path?: string) {
  return corePath(`tinker/${path || ''}`)
}

export function testsPath(path?: string) {
  return frameworkPath(`tests/${path || ''}`)
}

export function typesPath(path?: string) {
  return corePath(`types/${path || ''}`)
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

export function vitePath(path?: string) {
  return corePath(`vite/${path || ''}`)
}

export function xRayPath(path?: string) {
  return frameworkPath(`stacks/x-ray/${path || ''}`)
}

export const path = {
  actionsPath,
  userActionsPath,
  aiPath,
  assetsPath,
  relativeActionsPath,
  aliasPath,
  analyticsPath,
  arraysPath,
  appPath,
  authPath,
  buddyPath,
  buildEnginePath,
  libsEntriesPath,
  buildPath,
  cachePath,
  chatPath,
  cliPath,
  cloudPath,
  frameworkCloudPath,
  collectionsPath,
  commandsPath,
  componentsPath,
  configPath,
  projectConfigPath,
  corePath,
  customElementsDataPath,
  databasePath,
  datetimePath,
  developmentPath,
  desktopPath,
  docsPath,
  dnsPath,
  emailPath,
  enumsPath,
  errorHandlingPath,
  eventsPath,
  coreEnvPath,
  healthPath,
  examplesPath,
  fakerPath,
  frameworkPath,
  storagePath,
  functionsPath,
  gitPath,
  langPath,
  layoutsPath,
  libsPath,
  libraryEntryPath,
  lintPath,
  listenersPath,
  loggingPath,
  jobsPath,
  modulesPath,
  ormPath,
  objectsPath,
  onboardingPath,
  notificationsPath,
  packageJsonPath,
  viewsPath,
  pathPath,
  paymentsPath,
  projectPath,
  projectStoragePath,
  publicPath,
  pushPath,
  queryBuilderPath,
  queuePath,
  realtimePath,
  resourcesPath,
  replPath,
  routerPath,
  routesPath,
  runtimePath,
  searchEnginePath,
  schedulerPath,
  settingsPath,
  smsPath,
  signalsPath,
  slugPath,
  scriptsPath,
  securityPath,
  serverPath,
  serverlessPath,
  stacksPath,
  stringsPath,
  storesPath,
  testingPath,
  testsPath,
  tinkerPath,
  typesPath,
  uiPath,
  userEventsPath,
  userJobsPath,
  userListenersPath,
  userMiddlewarePath,
  userModelsPath,
  userNotificationsPath,
  utilsPath,
  validationPath,
  vitePath,
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

export { basename, delimiter, dirname, extname, format, isAbsolute, join, normalize, normalizeString, parse, relative, resolve, sep, toNamespacedPath }
