import { resolve } from 'pathe'

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
  return frameworkPath(`build/${path || ''}`)
}

export function buildEnginePath(path?: string) {
  return buildPath(`${path || ''}`)
}

export function buildEntriesPath(path?: string) {
  return buildPath(`entries/${path || ''}`)
}

export function cliPath(path?: string) {
  return frameworkPath(`cli/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

export function componentsPath(path?: string) {
  return projectPath(`components/${path || ''}`)
}

export function configPath(path?: string) {
  return frameworkPath(`config/${path || ''}`)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
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
  return frameworkPath(`modules/${path || ''}`)
}

export function pagesEnginePath(path?: string) {
  return frameworkPath(`pages/${path || ''}`)
}

export function routerPath(path?: string) {
  return frameworkPath(`router/${path || ''}`)
}

export function typesPath(path?: string) {
  return frameworkPath(`types/${path || ''}`)
}

export function uiEnginePath(path?: string) {
  return frameworkPath(`ui/${path || ''}`)
}

export function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return frameworkPath(`./${type}/package.json`)
}

export function pagesPath(path?: string) {
  return projectPath(`pages/${path || ''}`)
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
