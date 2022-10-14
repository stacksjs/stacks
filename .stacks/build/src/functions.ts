import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../../types'
import { functionLibrary } from '../../config/library'
import { autoImports } from '../src'
import alias from '../src/alias'
import { buildEntriesPath, frameworkPath, functionsPath, projectPath } from '../utils/src'

const config: ViteConfig = {
  root: functionsPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

  resolve: {
    alias,
  },

  plugins: [
    autoImports(),
  ],

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('functions/dist'),
    emptyOutDir: true,
    sourcemap: functionLibrary.shouldGenerateSourcemap,
    lib: {
      entry: buildEntriesPath('functions.ts'),
      name: functionLibrary.name,
      formats: functionLibrary.shouldBuildIife ? ['cjs', 'es', 'iife'] : ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        if (format === 'iife')
          return 'index.iife.js'

        return 'index.?.js'
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
