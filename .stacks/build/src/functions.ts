import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from 'types'
import { library } from 'config'
import { buildEntriesPath, frameworkPath, functionsPath, projectPath } from 'helpers'
import { alias, autoImports } from 'stacks'

export const functionsConfig: ViteConfig = {
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
    sourcemap: library.functions.shouldGenerateSourcemap,
    lib: {
      entry: buildEntriesPath('functions.ts'),
      name: library.functions.name,
      formats: library.functions.shouldBuildIife ? ['cjs', 'es', 'iife'] : ['cjs', 'es'],
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
    return functionsConfig

  // command === 'build'
  return functionsConfig
})
