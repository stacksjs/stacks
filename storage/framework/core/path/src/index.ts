import type { ParsedPath } from 'node:path'
import os from 'node:os'
import {
  basename,
  delimiter,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,

  relative,
  resolve,
  sep,
  toNamespacedPath,
} from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/logging'

/**
 * Returns the path to the `actions` directory. The `actions` directory
 * contains the core Stacks' actions.
 *
 * @param path - The relative path to the file or directory.
 * @returns The absolute path to the file or directory.
 * @example
 * ```ts
 * import { actionsPath } from '@stacksjs/path'
 *
 * console.log(actionsPath('path/to/action.ts')) // Outputs the absolute path to 'path/to/action.ts' within the `actions` directory
 * ```
 */
export function actionsPath(path?: string): string {
  return corePath(`actions/${path || ''}`)
}

export function relativeActionsPath(path?: string): string {
  return relative(projectPath(), actionsPath(path))
}

export function userActionsPath(path?: string, options?: { relative: true }): string {
  const absolutePath = appPath(`Actions/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

export function builtUserActionsPath(path?: string, options?: { relative: boolean }): string {
  const absolutePath = frameworkPath(`actions/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

export function userComponentsPath(path?: string): string {
  return libsPath(`components/${path || ''}`)
}

export function userViewsPath(path?: string): string {
  return resourcesPath(`views/${path || ''}`)
}

export function userFunctionsPath(path?: string): string {
  return resourcesPath(`functions/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Jobs` directory.
 *
 * @param path - The relative path to the file or directory within the `Jobs` directory.
 * @returns The absolute path to the specified file or directory within the user-defined `Jobs` directory.
 * @example
 * ```ts
 * import { userJobsPath } from '@stacksjs/path'
 *
 * console.log(userJobsPath('MyJob.ts')) // Outputs the absolute path to 'MyJob.ts' within the user-defined `Jobs` directory.
 * ```
 */
export function userJobsPath(path?: string): string {
  return appPath(`Jobs/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Listeners` directory.
 *
 * @param path - The relative path to the file or directory within the `Listeners` directory.
 * @returns The absolute path to the specified file or directory within the user-defined `Listeners` directory.
 * @example
 * ```ts
 * import { userListenersPath } from '@stacksjs/path'
 *
 * console.log(userListenersPath('MyListener.ts')) // Outputs the absolute path to 'MyListener.ts' within the user-defined `Listeners` directory.
 * ```
 */
export function userListenersPath(path?: string): string {
  return appPath(`Listeners/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Middleware` directory.
 *
 * @param path - The relative path to the file or directory within the Middleware directory.
 * @returns The absolute path to the specified file or directory within the user-defined Middleware directory.
 * @example
 * ```ts
 * import { userMiddlewarePath } from '@stacksjs/path'
 *
 * console.log(userMiddlewarePath('MyMiddleware.ts')) // Outputs the absolute path to 'MyMiddleware.ts' within the user-defined Middleware directory.
 * ```
 */
export function userMiddlewarePath(path?: string): string {
  return appPath(`Middleware/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Models` directory.
 *
 * @param path - The relative path to the file or directory within the `Models` directory.
 * @returns The absolute path to the specified file or directory within the user-defined `Models` directory.
 * @example
 * ```ts
 * import { userModelsPath } from '@stacksjs/path'
 *
 * console.log(userModelsPath('MyModel.ts')) // Outputs the absolute path to 'MyModel.ts' within the user-defined `Models` directory.
 * ```
 */
export function userModelsPath(path?: string): string {
  return appPath(`Models/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Notifications` directory.
 *
 * @param path - The relative path to the file or directory within the `Notifications` directory.
 * @returns The absolute path to the specified file or directory within the user-defined `Notifications` directory.
 * @example
 * ```ts
 * import { userNotificationsPath } from '@stacksjs/path'
 *
 * console.log(userNotificationsPath('MyNotification.ts')) // Outputs the absolute path to 'MyNotification.ts' within the user-defined `Notifications` directory.
 * ```
 */
export function userNotificationsPath(path?: string): string {
  return appPath(`Notifications/${path || ''}`)
}

export function userDatabasePath(path?: string): string {
  return projectPath(`database/${path || ''}`)
}

export function userMigrationsPath(path?: string): string {
  return userDatabasePath(`migrations/${path || ''}`)
}

/**
 * Returns the path to the user-defined `Events.ts` file.
 *
 * @returns The absolute path to the `Events.ts` file within the user-defined directory.
 * @example
 * ```ts
 * import { userEventsPath } from '@stacksjs/path'
 *
 * console.log(userEventsPath()) // Outputs the absolute path to 'Events.ts' within the user-defined directory.
 * ```
 */
export function userEventsPath(): string {
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
 * import { aiPath } from '@stacksjs/path'
 *
 * console.log(aiPath('src/drivers/example.ts')) // Outputs the absolute path to 'openai.ts' within the AI directory
 * ```
 */
export function aiPath(path?: string): string {
  return corePath(`ai/${path || ''}`)
}

/**
 * Returns the path to the `assets` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `assets` directory.
 * @returns The absolute path to the specified file or directory within the `assets` directory.
 * @example
 * ```ts
 * import { assetsPath } from '@stacksjs/path'
 *
 * console.log(assetsPath('images/logo.png')) // Outputs the absolute path to 'images/logo.png' within the `assets` directory.
 * ```
 */
export function assetsPath(path?: string): string {
  return resourcesPath(`assets/${path || ''}`)
}

/**
 * Returns the path to the `alias` directory within the core directory.
 *
 * @returns The absolute path to the `alias` directory.
 * @example
 * ```ts
 * import { aliasPath } from '@stacksjs/path'
 *
 * console.log(aliasPath()) // Outputs the absolute path to the `alias` directory.
 * ```
 */
export function aliasPath(): string {
  return corePath('alias/src/index.ts')
}

/**
 * Returns the path to the `buddy` directory, optionally relative to the current working directory.
 *
 * @param path - The relative path to the file or directory within the buddy directory.
 * @param options - Optional. An object containing configuration settings.
 * @param options.relative - If true, returns the path relative to the current working directory.
 * @returns The absolute or relative path to the specified file or directory within the buddy  * @returns The absolute or relative path to the specified file or directory within the buddy directory.
 * @example
 * ```ts
 * import { buddyPath } from '@stacksjs/path'
 *
 * console.log(buddyPath('config/buddy.json')) // Outputs the absolute path to 'config/buddy.json' within the buddy directory.
 * console.log(buddyPath('config/buddy.json', { relative: true })) // Outputs the relative path to 'config/buddy.json' within the buddy directory.
 * ```
 */
export function buddyPath(path?: string, options?: { relative?: boolean }): string {
  const absolutePath = corePath(`buddy/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

/**
 * Returns the path to the `runtime` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the runtime directory.
 * @returns The absolute path to the specified file or directory within the runtime directory.
 * @example
 * ```ts
 * import { runtimePath } from '@stacksjs/path'
 *
 * console.log(runtimePath('runtime-config.json')) // Outputs the absolute path to 'runtime-config.json' within the runtime directory.
 * ```
 */
export function runtimePath(path?: string): string {
  return frameworkPath(`buddy/${path || ''}`)
}

/**
 * Returns the path to the `analytics` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `analytics` directory.
 * @returns The absolute path to the specified file or directory within the `analytics` directory.
 * @example
 * ```ts
 * import { analyticsPath } from '@stacksjs/path'
 *
 * console.log(analyticsPath('data/report.csv')) // Outputs the absolute path to 'data/report.csv' within the `analytics` directory.
 * ```
 */
export function analyticsPath(path?: string): string {
  return corePath(`analytics/${path || ''}`)
}

/**
 * Returns the path to the `arrays` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `arrays` directory.
 * @returns The absolute path to the specified file or directory within the `arrays` directory.
 * @example
 * ```ts
 * import { arraysPath } from '@stacksjs/path'
 *
 * console.log(arraysPath('list.txt')) // Outputs the absolute path to 'list.txt' within the `arrays` directory.
 * ```
 */
export function arraysPath(path?: string): string {
  return corePath(`arrays/${path || ''}`)
}

/**
 * Returns the path to the `app` directory, optionally relative to the project directory.
 *
 * @param path - The relative path to the file or directory within the app directory.
 * @returns The absolute path to the specified file or directory within the app directory.
 * @example
 * ```ts
 * import { appPath } from '@stacksjs/path'
 *
 * console.log(appPath('Actions/DummyAction.ts')) // Outputs the absolute path to 'Actions/DummyAction.ts' within the app directory.
 * ```
 */
export function appPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = projectPath(`app/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}

/**
 * Returns the path to the `auth` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the auth directory.
 * @returns The absolute path to the specified file or directory within the auth directory.
 * @example
 * ```ts
 * import { authPath } from '@stacksjs/path'
 *
 * console.log(authPath('login.ts')) // Outputs the absolute path to 'login.ts' within the auth directory.
 * ```
 */
export function authPath(path?: string): string {
  return corePath(`auth/${path || ''}`)
}

/**
 * Returns the path to the `auth` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the auth directory.
 * @returns The absolute path to the specified file or directory within the auth directory.
 * @example
 * ```ts
 * import { coreApiPath } from '@stacksjs/path'
 *
 * console.log(coreApiPath('login.ts')) // Outputs the absolute path to 'login.ts' within the auth directory.
 * ```
 */
export function coreApiPath(path?: string): string {
  return corePath(`api/${path || ''}`)
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
export function buildPath(path?: string): string {
  return corePath(`build/${path || ''}`)
}

/**
 * Returns the path to the build engine directory.
 *
 * @param path - The relative path to the file or directory within the build engine directory.
 * @returns The absolute path to the specified file or directory within the build engine directory.
 */
export function buildEnginePath(path?: string): string {
  return buildPath(`${path || ''}`)
}

/**
 * Returns the path to the `libs` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the `libs` directory.
 * @returns The absolute path to the specified file or directory within the `libs` directory.
 */
export function libsPath(path?: string): string {
  return frameworkPath(`libs/${path || ''}`)
}

/**
 * Returns the path to the user `libs` directory within the root project directory.
 *
 * @param path - The relative path to the file or directory within the `libs` directory.
 * @returns The absolute path to the specified file or directory within the `libs` directory.
 */
export function userLibsPath(path?: 'components' | 'functions' | string): string {
  return resourcesPath(`${path || ''}`)
}

/**
 * Returns the path to the `entries` directory within the `libs` directory.
 *
 * @param path - The relative path to the file or directory within the `entries` directory.
 * @returns The absolute path to the specified file or directory within the `entries` directory.
 */
export function libsEntriesPath(path?: string): string {
  return libsPath(`entries/${path || ''}`)
}

/**
 * Returns the path to the `cache` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the cache directory.
 * @returns The absolute path to the specified file or directory within the cache directory.
 */
export function cachePath(path?: string): string {
  return corePath(`cache/${path || ''}`)
}

/**
 * Returns the path to the `chat` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the chat directory.
 * @returns The absolute path to the specified file or directory within the chat directory.
 */
export function chatPath(path?: string): string {
  return corePath(`chat/${path || ''}`)
}

/**
 * Returns the path to the `cli` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the cli directory.
 * @returns The absolute path to the specified file or directory within the cli directory.
 */
export function cliPath(path?: string): string {
  return corePath(`cli/${path || ''}`)
}

/**
 * Returns the path to the `cloud` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the cloud directory.
 * @returns The absolute path to the specified file or directory within the cloud directory.
 */
export function cloudPath(path?: string): string {
  return corePath(`cloud/${path || ''}`)
}

/**
 * Returns the path to the `cloud` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the framework cloud directory.
 * @returns The absolute path to the specified file or directory within the framework cloud directory.
 */
export function frameworkCloudPath(path?: string): string {
  return frameworkPath(`cloud/${path || ''}`)
}

/**
 * Returns the path to the `collections` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `collections` directory.
 * @returns The absolute path to the specified file or directory within the `collections` directory.
 */
export function collectionsPath(path?: string): string {
  return corePath(`collections/${path || ''}`)
}

/**
 * Returns the path to the `Commands` directory within the app directory.
 *
 * @param path - The relative path to the file or directory within the `Commands` directory.
 * @returns The absolute path to the specified file or directory within the `Commands` directory.
 */
export function commandsPath(path?: string): string {
  return appPath(`Commands/${path || ''}`)
}

/**
 * Returns the path to the `components` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `components` directory.
 * @returns The absolute path to the specified file or directory within the `components` directory.
 */
export function componentsPath(path?: string): string {
  return userLibsPath(`components/${path || ''}`)
}

/**
 * Returns the path to the `config` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the config directory.
 * @returns The absolute path to the specified file or directory within the config directory.
 */
export function configPath(path?: string): string {
  return corePath(`config/${path || ''}`)
}

/**
 * Returns the path to the `core` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the core directory.
 * @returns The absolute path to the specified file or directory within the core directory.
 */
export function corePath(path?: string): string {
  return frameworkPath(`core/${path || ''}`)
}

/**
 * Returns the absolute path to the `custom-elements.json` file within the core directory.
 *
 * @returns The absolute path to the `custom-elements.json` file.
 */
export function customElementsDataPath(): string {
  return frameworkPath('core/custom-elements.json')
}

/**
 * Returns the path to the `database` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the database directory.
 * @returns The absolute path to the specified file or directory within the database directory.
 */
export function databasePath(path?: string): string {
  return corePath(`database/${path || ''}`)
}

/**
 * Returns the path to the `datetime` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the datetime directory.
 * @returns The absolute path to the specified file or directory within the datetime directory.
 */
export function datetimePath(path?: string): string {
  return corePath(`datetime/${path || ''}`)
}

/**
 * Returns the path to the `development` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the development directory.
 * @returns The absolute path to the specified file or directory within the development directory.
 */
export function developmentPath(path?: string): string {
  return corePath(`development/${path || ''}`)
}

/**
 * Returns the path to the `desktop` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the desktop directory.
 * @returns The absolute path to the specified file or directory within the desktop directory.
 */
export function desktopPath(path?: string): string {
  return corePath(`desktop/${path || ''}`)
}

/**
 * Returns the path to the `docs` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `docs` directory.
 * @returns The absolute path to the specified file or directory within the `docs` directory.
 */
export function docsPath(path?: string): string {
  return corePath(`docs/${path || ''}`)
}

/**
 * Returns the path to the `domains` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `domains` directory.
 * @returns The absolute path to the specified file or directory within the `domains` directory.
 */
export function dnsPath(path?: string): string {
  return corePath(`domains/${path || ''}`)
}

/**
 * Returns the path to the `email` directory within the `notifications` directory.
 *
 * @param path - The relative path to the file or directory within the email directory.
 * @returns The absolute path to the specified file or directory within the email directory.
 */
export function emailPath(path?: string): string {
  return notificationsPath(`email/${path || ''}`)
}

/**
 * Returns the path to the `enums` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `enums` directory.
 * @returns The absolute path to the specified file or directory within the `enums` directory.
 */
export function enumsPath(path?: string): string {
  return corePath(`enums/${path || ''}`)
}

/**
 * Returns the path to the `eslint-plugin` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the eslint-plugin directory.
 * @returns The absolute path to the specified file or directory within the eslint-plugin directory.
 */
export function eslintPluginPath(path?: string): string {
  return corePath(`eslint-plugin/${path || ''}`)
}

/**
 * Returns the path to the `error-handling` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the error-handling directory.
 * @returns The absolute path to the specified file or directory within the error-handling directory.
 */
export function errorHandlingPath(path?: string): string {
  return corePath(`error-handling/${path || ''}`)
}

/**
 * Returns the path to the `events` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `events` directory.
 * @returns The absolute path to the specified file or directory within the `events` directory.
 */
export function eventsPath(path?: string): string {
  return corePath(`events/${path || ''}`)
}

/**
 * Returns the path to the `env` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the env directory.
 * @returns The absolute path to the specified file or directory within the env directory.
 */
export function coreEnvPath(path?: string): string {
  return corePath(`env/${path || ''}`)
}

/**
 * Returns the path to the `examples` directory within the framework directory, filtered by type.
 *
 * @param type - The type of examples to filter by ('vue-components' or 'web-components').
 * @returns The absolute path to the specified type of examples within the `examples` directory.
 */
export function examplesPath(type?: 'vue-components' | 'web-components'): string {
  return frameworkPath(`examples/${type || ''}`)
}

/**
 * Returns the path to the `faker` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the faker directory.
 * @returns The absolute path to the specified file or directory within the faker directory.
 */
export function fakerPath(path?: string): string {
  return corePath(`faker/${path || ''}`)
}

/**
 * Returns the path to the framework directory, optionally relative to the current working directory.
 *
 * @param path - The relative path to the file or directory within the framework directory.
 * @param options - Optional. An object containing configuration settings.
 * @param options.relative - If true, returns the path relative to the current working directory.
 * @param options.cwd - Specifies a custom working directory.
 * @returns The absolute or relative path to the specified file or directory within the framework directory.
 */
export function frameworkPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = storagePath(`framework/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}

/**
 * Returns the path to the `frontend` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the health directory.
 * @returns The absolute path to the specified file or directory within the health directory.
 */
export function browserPath(path?: string): string {
  return corePath(`browser/${path || ''}`)
}

/**
 * Returns the path to the `health` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the health directory.
 * @returns The absolute path to the specified file or directory within the health directory.
 */
export function healthPath(path?: string): string {
  return corePath(`health/${path || ''}`)
}

/**
 * Returns the path to the `functions` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `functions` directory.
 * @returns The absolute path to the specified file or directory within the `functions` directory.
 */
export function functionsPath(path?: string): string {
  return userLibsPath(`functions/${path || ''}`)
}

/**
 * Returns the path to the `git` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the git directory.
 * @returns The absolute path to the specified file or directory within the git directory.
 */
export function gitPath(path?: string): string {
  return corePath(`git/${path || ''}`)
}

/**
 * Returns the path to the `lang` directory, optionally relative to the project directory.
 *
 * @param path - The relative path to the file or directory within the lang directory.
 * @returns The absolute path to the specified file or directory within the lang directory.
 */
export function langPath(path?: string): string {
  return resourcesPath(`lang/${path || ''}`)
}

/**
 * Returns the path to the `layouts` directory within the `resources` directory, optionally relative to the current working directory.
 *
 * @param path - The relative path to the file or directory within the `layouts` directory.
 * @param options - Optional. An object containing configuration settings.
 * @param options.relative - If true, returns the path relative to the current working directory.
 * @param options.defaults - If true, returns the path to the `defaults/layouts` directory.
 * @returns The absolute or relative path to the specified file or directory within the `layouts` directory.
 */
export function layoutsPath(path?: string, options?: { relative?: boolean, defaults?: boolean }): string {
  let absolutePath
  if (options?.defaults)
    absolutePath = frameworkPath(`defaults/layouts/${path || ''}`)
  else
    absolutePath = resourcesPath(`layouts/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

/**
 * Returns the path to the library entry file, filtered by library type.
 *
 * @param type - The type of library ('vue-components', 'web-components', or 'functions').
 * @returns The absolute path to the specified library entry file.
 */
export type LibraryType = 'vue-components' | 'web-components' | 'functions'
export function libraryEntryPath(type: LibraryType): string {
  return libsEntriesPath(`${type}.ts`)
}

/**
 * Returns the path to the `lint` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the lint directory.
 * @returns The absolute path to the specified file or directory within the lint directory.
 */
export function lintPath(path?: string): string {
  return corePath(`lint/${path || ''}`)
}

/**
 * Returns the path to the `listeners` directory within the app directory.
 *
 * @param path - The relative path to the file or directory within the `listeners` directory.
 * @returns The absolute path to the specified file or directory within the `listeners` directory.
 */
export function listenersPath(path?: string): string {
  return appPath(`Listeners/${path || ''}`)
}

/**
 * Returns the path to the `jobs` directory within the app directory.
 *
 * @param path - The relative path to the file or directory within the `jobs` directory.
 * @returns The absolute path to the specified file or directory within the `jobs` directory.
 */
export function jobsPath(path?: string): string {
  return appPath(`Jobs/${path || ''}`)
}

/**
 * Returns the path to the `logging` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the logging directory.
 * @returns The absolute path to the specified file or directory within the logging directory.
 */
export function loggingPath(path?: string): string {
  return corePath(`logging/${path || ''}`)
}

/**
 * Returns the path to the `logs` directory within the project storage directory.
 *
 * @param path - The relative path to the file or directory within the `logs` directory.
 * @returns The absolute path to the specified file or directory within the `logs` directory.
 */
export function logsPath(path?: string): string {
  return storagePath(`logs/${path || ''}`)
}

/**
 * Returns the path to the `models` directory within the app directory.
 *
 * @param path - The relative path to the file or directory within the `models` directory.
 * @returns The absolute path to the specified file or directory within the `models` directory.
 */
export function modelsPath(path?: string): string {
  return appPath(`models/${path || ''}`)
}

/**
 * Returns the path to the `modules` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `modules` directory.
 * @returns The absolute path to the specified file or directory within the `modules` directory.
 */
export function modulesPath(path?: string): string {
  return resourcesPath(`modules/${path || ''}`)
}

/**
 * Returns the path to the `notifications` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `notifications` directory.
 * @returns The absolute path to the specified file or directory within the `notifications` directory.
 */
export function notificationsPath(path?: string): string {
  return corePath(`notifications/${path || ''}`)
}

/**
 * Returns the path to the `orm` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the orm directory.
 * @returns The absolute path to the specified file or directory within the orm directory.
 */
export function ormPath(path?: string): string {
  return corePath(`orm/${path || ''}`)
}

/**
 * Returns the path to the `objects` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `objects` directory.
 * @returns The absolute path to the specified file or directory within the `objects` directory.
 */
export function objectsPath(path?: string): string {
  return corePath(`objects/${path || ''}`)
}

/**
 * Returns the default path to the onboarding views within the project directory, or a specified path.
 *
 * @param path - The relative path to the file or directory within the project directory. Defaults to 'views/dashboard/onboarding'.
 * @returns The absolute path to the specified file or directory within the project directory.
 */
export function onboardingPath(path?: string): string {
  return projectPath(`${path || 'views/dashboard/onboarding'}`)
}

/**
 * Returns the path to the `package.json` file of a specified library type within the framework directory.
 *
 * @param type - The type of the library ('vue-components', 'web-components', or 'functions') for which to return the package.json path.
 * @returns The absolute path to the specified package.json file within the framework directory.
 */
export function packageJsonPath(type: LibraryType): string {
  if (type === 'vue-components')
    return frameworkPath('libs/components/vue/package.json')
  if (type === 'web-components')
    return frameworkPath('libs/components/web/package.json')

  return frameworkPath(`libs/${type}/package.json`)
}

/**
 * Returns the path to the `views` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `views` directory.
 * @returns The absolute path to the specified file or directory within the `views` directory.
 */
export function viewsPath(path?: string): string {
  return resourcesPath(`views/${path || ''}`)
}

/**
 * Returns the path to the `path` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the path directory.
 * @returns The absolute path to the specified file or directory within the path directory.
 */
export function pathPath(path?: string): string {
  return corePath(`path/${path || ''}`)
}

/**
 * Returns the path to the `payments` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `payments` directory.
 * @returns The absolute path to the specified file or directory within the `payments` directory.
 */
export function paymentsPath(path?: string): string {
  return corePath(`payments/${path || ''}`)
}

/**
 * Returns the project path, resolving from the current working directory and moving up until the storage directory is no longer part of the path.
 *
 * @param filePath - The relative path to append to the project path. Defaults to an empty string.
 * @returns The absolute path to the specified file or directory within the project directory.
 */
export function projectPath(filePath = '', options?: { relative: boolean }): string {
  let path = process.cwd()

  while (path.includes('storage')) path = resolve(path, '..')

  const finalPath = resolve(path, filePath)

  // If the `relative` option is true, return the path relative to the current working directory
  if (options?.relative)
    return relative(process.cwd(), finalPath)

  return finalPath
}

/**
 * Finds and returns the absolute path of a specified project by name.
 *
 * @param project - The name of the project to find.
 * @returns The absolute path to the specified project.
 * @throws Error if the project with the specified name cannot be found.
 */
export async function findProjectPath(project: string): Promise<string> {
  const projectList = Bun.spawnSync(['buddy', 'projects:list', '--quiet']).stdout.toString()
  log.debug(`ProjectList in findProjectPath ${projectList}`)

  // get the list of all Stacks project paths (on the system)
  const projects = projectList
    .split('\n')
    .filter((line: string) => line.startsWith('   - '))
    .map((line: string) => line.trim().substring(4))

  log.debug(`Projects in findProjectPath ${projects}`)

  // since we are targeting a specific project, find its path
  const projectPath = projects.find((proj: string) => proj.includes(project))

  if (!projectPath)
    throw new Error(`Could not find project with name: ${project}`)

  return projectPath.startsWith('/') ? projectPath : `/${projectPath}`
}

/**
 * Returns the path to the `config` directory within the project directory.
 *
 * @param path - The relative path to the file or directory within the config directory.
 * @returns The absolute path to the specified file or directory within the config directory.
 */
export function projectConfigPath(path?: string): string {
  return projectPath(`config/${path || ''}`)
}

/**
 * Returns the path to the `storage` directory within the project directory.
 *
 * @param path - The relative path to the file or directory within the storage directory.
 * @returns The absolute path to the specified file or directory within the storage directory.
 */
export function storagePath(path?: string): string {
  return projectPath(`storage/${path || ''}`)
}

/**
 * Returns the path to the `public` directory within the project directory.
 *
 * @param path - The relative path to the file or directory within the public directory.
 * @returns The absolute path to the specified file or directory within the public directory.
 */
export function publicPath(path?: string): string {
  return projectPath(`public/${path || ''}`)
}

/**
 * Returns the path to the `push` directory within the `notifications` directory.
 *
 * @param path - The relative path to the file or directory within the push directory.
 * @returns The absolute path to the specified file or directory within the push directory.
 */
export function pushPath(path?: string): string {
  return notificationsPath(`push/${path || ''}`)
}

/**
 * Returns the path to the `query-builder` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the query-builder directory.
 * @returns The absolute path to the specified file or directory within the query-builder directory.
 */
export function queryBuilderPath(path?: string): string {
  return corePath(`query-builder/${path || ''}`)
}

/**
 * Returns the path to the `queue` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the queue directory.
 * @returns The absolute path to the specified file or directory within the queue directory.
 */
export function queuePath(path?: string): string {
  return corePath(`queue/${path || ''}`)
}

/**
 * Returns the path to the `realtime` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the realtime directory.
 * @returns The absolute path to the specified file or directory within the realtime directory.
 */
export function realtimePath(path?: string): string {
  return corePath(`realtime/${path || ''}`)
}

/**
 * Returns the path to the `resources` directory within the project storage directory, with an option for relative paths.
 *
 * @param path - The relative path to the file or directory within the `resources` directory.
 * @param options - Optional. An object containing configuration settings.
 * @param options.relative - If true, returns the path relative to the current working directory.
 * @returns The absolute or relative path to the specified file or directory within the `resources` directory.
 */
export function resourcesPath(path?: string, options?: { relative?: boolean }): string {
  if (options?.relative) {
    const absolutePath = projectPath(`resources/${path || ''}`)
    return relative(process.cwd(), absolutePath)
  }

  return projectPath(`resources/${path || ''}`)
}

/**
 * Returns the path to the `repl` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the repl directory.
 * @returns The absolute path to the specified file or directory within the repl directory.
 */
export function replPath(path?: string): string {
  return corePath(`repl/${path || ''}`)
}

/**
 * Returns the path to the `router` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the router directory.
 * @returns The absolute path to the specified file or directory within the router directory.
 */
export function routerPath(path?: string): string {
  return corePath(`router/${path || ''}`)
}

/**
 * Returns the path to the `routes` directory within the `resources` directory, with an option for relative paths.
 *
 * @param path - The relative path to the file or directory within the `routes` directory.
 * @param options - Optional. An object containing configuration settings.
 * @param options.relative - If true, returns the path relative to the current working directory.
 * @returns The absolute or relative path to the specified file or directory within the `routes` directory.
 */
export function routesPath(path?: string, options?: { relative?: boolean }): string {
  const absolutePath = resourcesPath(`routes/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return projectPath(`routes/${path || ''}`)
}

/**
 * Returns the path to the `search-engine` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the search-engine directory.
 * @returns The absolute path to the specified file or directory within the search-engine directory.
 */
export function searchEnginePath(path?: string): string {
  return corePath(`search-engine/${path || ''}`)
}

/**
 * Returns the path to the `settings` directory within the project directory, defaulting to the views/dashboard/settings directory.
 *
 * @param path - The relative path to the file or directory within the `settings` directory.
 * @returns The absolute path to the specified file or directory within the `settings` directory.
 */
export function settingsPath(path?: string): string {
  return projectPath(`${path || 'views/dashboard/settings'}`)
}

/**
 * Returns the path to the `scripts` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the `scripts` directory.
 * @returns The absolute path to the specified file or directory within the `scripts` directory.
 */
export function scriptsPath(path?: string): string {
  return frameworkPath(`scripts/${path || ''}`)
}

/**
 * Returns the path to the `scheduler` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the scheduler directory.
 * @returns The absolute path to the specified file or directory within the scheduler directory.
 */
export function schedulerPath(path?: string): string {
  return corePath(`scheduler/${path || ''}`)
}

/**
 * Returns the path to the `slug` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the slug directory.
 * @returns The absolute path to the specified file or directory within the slug directory.
 */
export function slugPath(path?: string): string {
  return corePath(`slug/${path || ''}`)
}

/**
 * Returns the path to the `sms` directory within the `notifications` directory.
 *
 * @param path - The relative path to the file or directory within the `sms` directory.
 * @returns The absolute path to the specified file or directory within the `sms` directory.
 */
export function smsPath(path?: string): string {
  return notificationsPath(`sms/${path || ''}`)
}

/**
 * Returns the path to the `storage` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the storage directory.
 * @returns The absolute path to the specified file or directory within the storage directory.
 */
export function coreStoragePath(path?: string): string {
  return corePath(`storage/${path || ''}`)
}

/**
 * Returns the path to the `stores` directory within the `resources` directory.
 *
 * @param path - The relative path to the file or directory within the `stores` directory.
 * @returns The absolute path to the specified file or directory within the `stores` directory.
 */
export function storesPath(path?: string): string {
  return resourcesPath(`stores/${path || ''}`)
}

/**
 * Returns the path to the `security` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the security directory.
 * @returns The absolute path to the specified file or directory within the security directory.
 */
export function securityPath(path?: string): string {
  return corePath(`security/${path || ''}`)
}

/**
 * Returns the path to the `server` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the server directory.
 * @returns The absolute path to the specified file or directory within the server directory.
 */
export function serverPath(path?: string): string {
  return corePath(`server/${path || ''}`)
}

export function userServerPath(path?: string): string {
  return frameworkPath(`server/${path || ''}`)
}

/**
 * Returns the path to the `serverless` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `serverless` directory.
 * @returns The absolute path to the specified file or directory within the `serverless` directory.
 */
export function serverlessPath(path?: string): string {
  return corePath(`serverless/${path || ''}`)
}

/**
 * Returns the path to the specified directory or file within the framework's `src` directory.
 *
 * @param path - The relative path to the file or directory within the framework's `src` directory.
 * @returns The absolute path to the specified file or directory within the framework's `src` directory.
 */
export function stacksPath(path?: string): string {
  return frameworkPath(`src/${path || ''}`)
}

/**
 * Returns the path to the `shell` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the shell directory.
 * @returns The absolute path to the specified file or directory within the shell directory.
 */
export function shellPath(path?: string): string {
  return corePath(`shell/${path || ''}`)
}

/**
 * Returns the path to the `strings` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `strings` directory.
 * @returns The absolute path to the specified file or directory within the `strings` directory.
 */
export function stringsPath(path?: string): string {
  return corePath(`strings/${path || ''}`)
}

/**
 * Returns the path to the `testing` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the testing directory.
 * @returns The absolute path to the specified file or directory within the testing directory.
 */
export function testingPath(path?: string): string {
  return corePath(`testing/${path || ''}`)
}

/**
 * Returns the path to the `tinker` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the tinker directory.
 * @returns The absolute path to the specified file or directory within the tinker directory.
 */
export function tinkerPath(path?: string): string {
  return corePath(`tinker/${path || ''}`)
}

/**
 * Returns the path to the `tests` directory within the framework directory.
 *
 * @param path - The relative path to the file or directory within the `tests` directory.
 * @returns The absolute path to the specified file or directory within the `tests` directory.
 */
export function testsPath(path?: string): string {
  return frameworkPath(`tests/${path || ''}`)
}

/**
 * Returns the path to the `types` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `types` directory.
 * @returns The absolute path to the specified file or directory within the `types` directory.
 */
export function typesPath(path?: string): string {
  return corePath(`types/${path || ''}`)
}

/**
 * Returns the path to the `ui` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the ui directory.
 * @returns The absolute path to the specified file or directory within the ui directory.
 */
export function uiPath(path?: string, options?: { relative?: boolean }): string {
  const absolutePath = corePath(`ui/${path || ''}`)

  if (options?.relative)
    return relative(process.cwd(), absolutePath)

  return absolutePath
}

/**
 * Returns the path to the `utils` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the `utils` directory.
 * @returns The absolute path to the specified file or directory within the `utils` directory.
 */
export function utilsPath(path?: string): string {
  return corePath(`utils/${path || ''}`)
}

/**
 * Returns the path to the `validation` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the validation directory.
 * @returns The absolute path to the specified file or directory within the validation directory.
 */
export function validationPath(path?: string): string {
  return corePath(`validation/${path || ''}`)
}

/**
 * Returns the path to the `validation` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the validation directory.
 * @returns The absolute path to the specified file or directory within the validation directory.
 */
export function socialsPath(path?: string): string {
  return corePath(`socials/${path || ''}`)
}

/**
 * Returns the path to the `vite-config` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the vite-config directory.
 * @returns The absolute path to the specified file or directory within the vite-config directory.
 */
export function viteConfigPath(path?: string): string {
  return corePath(`vite-config/${path || ''}`)
}

/**
 * Returns the path to the `vite-plugin` directory within the core directory.
 *
 * @param path - The relative path to the file or directory within the vite directory.
 * @returns The absolute path to the specified file or directory within the vite directory.
 */
export function vitePluginPath(path?: string): string {
  return corePath(`vite-plugin/${path || ''}`)
}

/**
 * Returns the path to the `x-ray` directory within the `stacks` directory of the framework.
 *
 * @param path - The relative path to the file or directory within the x-ray directory.
 * @returns The absolute path to the specified file or directory within the x-ray directory.
 */
export function xRayPath(path?: string): string {
  return frameworkPath(`stacks/x-ray/${path || ''}`)
}

/**
 * Returns the path to the home directory, optionally appending a given path.
 *
 * @param path - The relative path to append to the home directory path.
 * @returns The absolute path to the specified file or directory within the home directory.
 */
export function homeDir(path?: string): string {
  return os.homedir() + (path ? (path.startsWith('/') ? '' : '/') + path : '~')
}

export interface Path {
  actionsPath: (path?: string) => string
  userActionsPath: (path?: string) => string
  builtUserActionsPath: (path?: string, option?: { relative: boolean }) => string
  userComponentsPath: (path?: string) => string
  userViewsPath: (path?: string) => string
  userFunctionsPath: (path?: string) => string
  aiPath: (path?: string) => string
  assetsPath: (path?: string) => string
  relativeActionsPath: (path?: string) => string
  aliasPath: (path?: string) => string
  analyticsPath: (path?: string) => string
  arraysPath: (path?: string) => string
  appPath: (path?: string) => string
  authPath: (path?: string) => string
  coreApiPath: (path?: string) => string
  buddyPath: (path?: string) => string
  buildEnginePath: (path?: string) => string
  libsEntriesPath: (path?: string) => string
  buildPath: (path?: string) => string
  cachePath: (path?: string) => string
  chatPath: (path?: string) => string
  cliPath: (path?: string) => string
  cloudPath: (path?: string) => string
  frameworkCloudPath: (path?: string) => string
  collectionsPath: (path?: string) => string
  commandsPath: (path?: string) => string
  componentsPath: (path?: string) => string
  configPath: (path?: string) => string
  projectConfigPath: (path?: string) => string
  corePath: (path?: string) => string
  customElementsDataPath: (path?: string) => string
  databasePath: (path?: string) => string
  datetimePath: (path?: string) => string
  developmentPath: (path?: string) => string
  desktopPath: (path?: string) => string
  docsPath: (path?: string) => string
  dnsPath: (path?: string) => string
  emailPath: (path?: string) => string
  enumsPath: (path?: string) => string
  eslintPluginPath: (path?: string) => string
  errorHandlingPath: (path?: string) => string
  eventsPath: (path?: string) => string
  coreEnvPath: (path?: string) => string
  healthPath: (path?: string) => string
  examplesPath: (type?: 'vue-components' | 'web-components') => string
  fakerPath: (path?: string) => string
  frameworkPath: (path?: string) => string
  browserPath: (path?: string) => string
  storagePath: (path?: string) => string
  functionsPath: (path?: string) => string
  gitPath: (path?: string) => string
  langPath: (path?: string) => string
  layoutsPath: (path?: string, options?: { relative?: boolean }) => string
  libsPath: (path?: string) => string
  userLibsPath: (path?: string) => string
  libraryEntryPath: (type: LibraryType) => string
  lintPath: (path?: string) => string
  listenersPath: (path?: string) => string
  loggingPath: (path?: string) => string
  logsPath: (path?: string) => string
  jobsPath: (path?: string) => string
  modulesPath: (path?: string) => string
  ormPath: (path?: string) => string
  objectsPath: (path?: string) => string
  onboardingPath: (path?: string) => string
  notificationsPath: (path?: string) => string
  packageJsonPath: (type: LibraryType) => string
  viewsPath: (path?: string) => string
  pathPath: (path?: string) => string
  paymentsPath: (path?: string) => string
  projectPath: (path?: string) => string
  findProjectPath: (project: string) => Promise<string>
  coreStoragePath: (path?: string) => string
  publicPath: (path?: string) => string
  pushPath: (path?: string) => string
  queryBuilderPath: (path?: string) => string
  queuePath: (path?: string) => string
  realtimePath: (path?: string) => string
  resourcesPath: (path?: string) => string
  replPath: (path?: string) => string
  routerPath: (path?: string) => string
  routesPath: (path?: string) => string
  runtimePath: (path?: string) => string
  searchEnginePath: (path?: string) => string
  schedulerPath: (path?: string) => string
  settingsPath: (path?: string) => string
  smsPath: (path?: string) => string
  slugPath: (path?: string) => string
  scriptsPath: (path?: string) => string
  securityPath: (path?: string) => string
  serverPath: (path?: string) => string
  userServerPath: (path?: string) => string
  serverlessPath: (path?: string) => string
  stacksPath: (path?: string) => string
  stringsPath: (path?: string) => string
  shellPath: (path?: string) => string
  storesPath: (path?: string) => string
  socialsPath: (path?: string) => string
  testingPath: (path?: string) => string
  testsPath: (path?: string) => string
  tinkerPath: (path?: string) => string
  typesPath: (path?: string) => string
  uiPath: (path?: string, options?: { relative?: boolean }) => string
  userDatabasePath: (path?: string) => string
  userMigrationsPath: (path?: string) => string
  userEventsPath: (path?: string) => string
  userJobsPath: (path?: string) => string
  userListenersPath: (path?: string) => string
  userMiddlewarePath: (path?: string) => string
  userModelsPath: (path?: string) => string
  userNotificationsPath: (path?: string) => string
  utilsPath: (path?: string) => string
  validationPath: (path?: string) => string
  viteConfigPath: (path?: string) => string
  vitePluginPath: (path?: string) => string
  xRayPath: (path?: string) => string
  homeDir: (path?: string) => string
  basename: (path: string) => string
  delimiter: () => ';' | ':'
  dirname: (path: string) => string
  extname: (path: string) => string
  isAbsolute: (path: string) => boolean
  join: (...paths: string[]) => string
  normalize: (path: string) => string
  relative: (from: string, to: string) => string
  resolve: (...paths: string[]) => string
  parse: (path: string) => ParsedPath
  sep: () => '/' | '\\'
  toNamespacedPath: (path: string) => string
}

export const path: Path = {
  actionsPath,
  userActionsPath,
  builtUserActionsPath,
  userComponentsPath,
  userViewsPath,
  userFunctionsPath,
  aiPath,
  assetsPath,
  relativeActionsPath,
  aliasPath,
  analyticsPath,
  arraysPath,
  appPath,
  authPath,
  coreApiPath,
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
  eslintPluginPath,
  errorHandlingPath,
  eventsPath,
  coreEnvPath,
  healthPath,
  examplesPath,
  fakerPath,
  frameworkPath,
  browserPath,
  storagePath,
  functionsPath,
  gitPath,
  langPath,
  layoutsPath,
  libsPath,
  userLibsPath,
  libraryEntryPath,
  lintPath,
  listenersPath,
  loggingPath,
  logsPath,
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
  findProjectPath,
  coreStoragePath,
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
  slugPath,
  scriptsPath,
  securityPath,
  serverPath,
  userServerPath,
  serverlessPath,
  stacksPath,
  stringsPath,
  shellPath,
  socialsPath,
  storesPath,
  testingPath,
  testsPath,
  tinkerPath,
  typesPath,
  uiPath,
  userDatabasePath,
  userMigrationsPath,
  userEventsPath,
  userJobsPath,
  userListenersPath,
  userMiddlewarePath,
  userModelsPath,
  userNotificationsPath,
  utilsPath,
  validationPath,
  viteConfigPath,
  vitePluginPath,
  xRayPath,
  homeDir,

  // path utils
  basename,
  delimiter: () => delimiter,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  parse,
  sep: () => sep,
  toNamespacedPath,
}

export { basename, delimiter, dirname, extname, isAbsolute, join, normalize, relative, resolve, sep, toNamespacedPath }
