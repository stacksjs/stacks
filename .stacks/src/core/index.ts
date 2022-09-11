import { resolve } from 'node:path'
import type { PluginOption, UserConfig } from 'vite'
import { createApp } from 'vue'
import { defineConfig } from 'vite'
import { defineConfig as defineTestConfig } from 'vitest/config'
import { componentsBuildOptions } from '../config/components'
import { webComponentsBuildOptions } from '../config/elements'
import { atomicCssEngine, autoImports, components, envPrefix, i18n, inspect, uiEngine } from './stacks'

export type ViteConfig = UserConfig

const Stacks = (isWebComponent = false) => <PluginOption>[
  inspect,

  uiEngine(isWebComponent),

  atomicCssEngine(isWebComponent),

  autoImports,

  components,

  i18n,
]

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect, createApp, defineConfig, defineTestConfig, envPrefix, i18n, componentsBuildOptions, webComponentsBuildOptions }
