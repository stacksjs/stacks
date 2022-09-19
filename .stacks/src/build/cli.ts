import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../types'
import { autoImports } from '..'
import alias from '../core/alias'
import { _dirname } from '../core/fs'

const config: ViteConfig = {
  root: resolve(_dirname, '../../../components'),

  envPrefix: 'STACKS_',

  resolve: {
    // dedupe: ['vue'],
    alias,
  },

  plugins: [
    autoImports,
  ],

  build: cliBuildOptions(),
}

export function cliBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../dist'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['node:url'],
    },
    lib: {
      entry: resolve(_dirname, '../cli.ts'),
      name: 'artisan',
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'cli.mjs'

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
