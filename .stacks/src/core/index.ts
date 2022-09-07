import { resolve } from 'pathe'
import type { PluginOption, UserConfig } from 'vite'
import { createApp } from 'vue'
import { defineConfig } from 'vite'
import { defineConfig as defineTestConfig } from 'vitest/config'
import { atomicCssEngine, autoImports, components, inspect, uiEngine } from '../config/stacks'

export type ViteConfig = UserConfig

const Stacks = (isWebComponent = false) => <PluginOption>[
  inspect,

  uiEngine(isWebComponent),

  atomicCssEngine(isWebComponent),

  autoImports,

  components,
]

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect, createApp, defineConfig, defineTestConfig }
