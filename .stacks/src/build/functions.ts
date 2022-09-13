import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../types'
import { defineConfig } from '../core'
import alias from '../core/alias'
import { functionLibraryName } from '../../../config/library'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

const config: ViteConfig = {
  resolve: {
    alias,
  },

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../functions/dist'),

    emptyOutDir: true,

    lib: {
      entry: resolve(_dirname, '../../../config/functions.ts'),
      name: functionLibraryName,
      formats: ['es', 'cjs'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.js'

        if (format === 'cjs')
          return 'index.cjs'

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
