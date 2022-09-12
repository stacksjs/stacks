import { resolve } from 'pathe'
import type { UserConfig } from 'vite'
import { createApp } from 'vue'
import { defineConfig } from 'vite'
import { defineConfig as defineTestConfig } from 'vitest/config'
import { componentsBuildOptions } from '../config/components'
import { webComponentsBuildOptions } from '../config/elements'
import { Stacks, atomicCssEngine, autoImports, components, envPrefix, i18n, inspect, uiEngine } from './stacks'

export type ViteConfig = UserConfig

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect, createApp, defineConfig, defineTestConfig, envPrefix, i18n, componentsBuildOptions, webComponentsBuildOptions }
