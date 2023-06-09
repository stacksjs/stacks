// framework-plugin

import { autoImports, components, cssEngine, inspect, layouts, pages, uiEngine } from '@stacksjs/build'
import type { ConfigEnv, Plugin, PluginOption } from 'vite'
import type { UserConfig } from 'vitepress'

export interface StacksPlugin extends Plugin {
  config: (config: UserConfig, env: ConfigEnv) => UserConfig
}

export type DevServerUrl = `${'http' | 'https'}://${string}:${number}`

export default function framework(config: PluginConfig) {
  return <PluginOption> [
    inspect(config),
    layouts(config),
    components(config),
    pages(config),
    autoImports(config),
    uiEngine(config),
    cssEngine(config),
  ]
}

// interface PluginConfig {
//   /**
//    * The path or paths of the entry points to compile.
//    */
//   input: string | string[]
//
//   /**
//    * Stacks's public directory.
//    *
//    * @default 'public'
//    */
//   publicDirectory?: string
//
//   /**
//    * The public subdirectory where compiled assets should be written.
//    *
//    * @default 'build'
//    */
//   buildDirectory?: string
//
//   /**
//    * Configuration for performing full page refresh on blade (or other) file changes.
//    *
//    * {@link https://github.com/ElMassimo/vite-plugin-full-reload}
//    * @default false
//    */
//   refresh?: boolean | string | string[] | RefreshConfig | RefreshConfig[]
//
//   /**
//    * Transform the code while serving.
//    */
//   transformOnServe?: (code: string, url: DevServerUrl) => string
// }

// interface RefreshConfig {
//   paths: string[]
//   config?: FullReloadConfig
// }

// export const refreshPaths = [
//   'resources/components/**',
//   'resources/views/**',
//   'resources/lang/**',
//   'resources/functions/**',
//   'components/**',
//   'views/**',
//   'lang/**',
//   'routes/**',
// ]

/**
 * Stacks plugin for Vite.
 *
 * @param config - A config object or relative path(s) of the scripts to be compiled.
 */
// export default function stacks(config: string | string[] | PluginConfig): [StacksPlugin, ...Plugin[]] {
// export default function stacks() {
//   // stacks vite plugin
// }
