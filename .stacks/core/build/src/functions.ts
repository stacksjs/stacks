import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { buildEntriesPath, frameworkPath, functionsPath, projectPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
import { autoImports } from '.'

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
    sourcemap: library.functions?.shouldGenerateSourcemap,
    lib: {
      entry: buildEntriesPath('functions.ts'),
      name: library.functions?.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

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
