import pathe from 'pathe'

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
function actionsPath(path?: string) {
  return corePath(`actions/${path || ''}`)
}

function aliasPath() {
  return frameworkPath('alias.ts')
}

function arraysPath(path?: string) {
  return corePath(`arrays/${path || ''}`)
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
function buildPath(path?: string) {
  return corePath(`build/${path || ''}`)
}

function buildEnginePath(path?: string) {
  return buildPath(`${path || ''}`)
}

function buildEntriesPath(path?: string) {
  return buildPath(`entries/${path || ''}`)
}

function cliPath(path?: string) {
  return stacksPath(`cli/${path || ''}`)
}

function collectionsPath(path?: string) {
  return corePath(`collections/${path || ''}`)
}

function componentsPath(path?: string) {
  return projectPath(`components/${path || ''}`)
}

function configPath() {
  return frameworkPath('config.ts')
}

function corePath(path?: string) {
  return frameworkPath(`core/${path || ''}`)
}

function docsPath(path?: string) {
  return corePath(`docs/${path || ''}`)
}

function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
}

function fsPath(path?: string) {
  return corePath(`fs/${path || ''}`)
}

function functionsPath(path?: string) {
  return projectPath(`functions/${path || ''}`)
}

function gitPath(path?: string) {
  return corePath(`git/${path || ''}`)
}

function langPath(path?: string) {
  return projectPath(`lang/${path || ''}`)
}

function libraryEntryPath(type: 'vue-components' | 'web-components' | 'functions') {
  return buildEntriesPath(`${type}.ts`)
}

function lintPath(path?: string) {
  return corePath(`lint/${path || ''}`)
}

function modulesPath(path?: string) {
  return corePath(`modules/${path || ''}`)
}

function objectsPath(path?: string) {
  return corePath(`objects/${path || ''}`)
}

function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return frameworkPath(`./${type}/package.json`)
}

function pagesPath(path?: string) {
  return projectPath(`pages/${path || ''}`)
}

function pathPath(path?: string) {
  return corePath(`path/${path || ''}`)
}

function projectPath(filePath = '') {
  let path = process.cwd()

  // workaround: run the follow command a few times because there is chance
  // that the cwd is a few dirs up, like in the case when a release happens
  // from a GitHub Action/workflow
  if (path.includes('.stacks'))
    path = pathe.resolve(path, '..')

  if (path.includes('.stacks'))
    path = pathe.resolve(path, '..')

  if (path.includes('.stacks'))
    path = pathe.resolve(path, '..')

  if (!path.includes('.stacks'))
    path = pathe.resolve(path, '.')

  return pathe.resolve(path, filePath)
}

function routerPath(path?: string) {
  return corePath(`router/${path || ''}`)
}

function routesPath(path?: string) {
  return projectPath(`routes/${path || ''}`)
}

function securityPath(path?: string) {
  return corePath(`security/${path || ''}`)
}

function stacksPath(path?: string) {
  return frameworkPath(`src/${path || ''}`)
}

function testsPath(path?: string) {
  return corePath(`tests/${path || ''}`)
}

function typesPath(path?: string) {
  return corePath(`types/${path || ''}`)
}

function stringsPath(path?: string) {
  return corePath(`strings/${path || ''}`)
}

function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

function uiPath(path?: string) {
  return corePath(`ui/${path || ''}`)
}

function utilsPath(path?: string) {
  return corePath(`utils/${path || ''}`)
}

export default {
  actionsPath,
  aliasPath,
  arraysPath,
  buildEnginePath,
  buildEntriesPath,
  buildPath,
  cliPath,
  collectionsPath,
  componentsPath,
  configPath,
  corePath,
  customElementsDataPath,
  docsPath,
  examplesPath,
  frameworkPath,
  fsPath,
  functionsPath,
  gitPath,
  langPath,
  libraryEntryPath,
  lintPath,
  modulesPath,
  objectsPath,
  packageJsonPath,
  pagesPath,
  ...pathe,
  pathPath,
  projectPath,
  routerPath,
  routesPath,
  scriptsPath,
  securityPath,
  stacksPath,
  stringsPath,
  testsPath,
  typesPath,
  uiPath,
  utilsPath,
}
