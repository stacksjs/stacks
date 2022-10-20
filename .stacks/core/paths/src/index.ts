import { resolve } from 'path'

export * from 'pathe'

/**
 * Returns the path to the `actions` directory. The actions directory
 * contains the core Stacks' actions. An action
 *
 * @param path string - relative path to the file or directory
 * @returns string - absolute path to the file or directory
 * @example
 * ```ts
 * buildPath('functions.vue')
 * buildPath('vue-components.ts')
 * ```
 */
export function actionsPath(path?: string) {
  return frameworkPath(`actions/${path || ''}`)
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

export function cliPath(path?: string) {
  return corePath(`cli/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

export function componentsPath(path?: string) {
  return projectPath(`components/${path || ''}`)
}

export function configPath(path?: string) {
  return corePath(`config/${path || ''}`)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
}

export function corePath(path?: string) {
  return frameworkPath(`core/${path || ''}`)
}

export function functionsPath(path?: string) {
  return projectPath(`functions/${path || ''}`)
}

export function langPath(path?: string) {
  return projectPath(`lang/${path || ''}`)
}

export function libraryEntryPath(type: 'vue-components' | 'web-components' | 'functions') {
  return buildEntriesPath(`${type}.ts`)
}

export function modulesPath(path?: string) {
  return corePath(`modules/${path || ''}`)
}

export function routerPath(path?: string) {
  return corePath(`router/${path || ''}`)
}

export function securityPath(path?: string) {
  return corePath(`security/${path || ''}`)
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

export function arraysPath(path?: string) {
  return corePath(`arrays/${path || ''}`)
}

export function collectionsPath(path?: string) {
  return corePath(`collections/${path || ''}`)
}

export function pathsPath(path?: string) {
  return corePath(`paths/${path || ''}`)
}

export function objectsPath(path?: string) {
  return corePath(`objects/${path || ''}`)
}

export function stringsPath(path?: string) {
  return corePath(`strings/${path || ''}`)
}

export function fsPath(path?: string) {
  return corePath(`fs/${path || ''}`)
}

export function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return frameworkPath(`./${type}/package.json`)
}

export function pagesPath(path?: string) {
  return corePath(`pages/${path || ''}`)
}

export function projectPath(filePath = '') {
  let path = process.cwd()

  // workaround: run the follow command a few times because there is chance
  // that the cwd is a few dirs up, like in the case when a release happens
  // from a GitHub Action/workflow
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

export function routesPath(path?: string) {
  return projectPath(`routes/${path || ''}`)
}
