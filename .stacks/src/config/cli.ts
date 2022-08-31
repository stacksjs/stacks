import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../core'
import { defineConfig } from '../core'
import alias from '../alias'

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    alias,
  },

  build: cliBuildOptions(),
}

export function cliBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/cli'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../cli/index.ts'),
      name: 'artisan',
      formats: ['es'],
      fileName: () => {
        return 'artisan.mjs'
      },
    },

    rollupOptions: {
      external: ['path'],
    },

    // sourcemap: true,
    // minify: false,
  }
}

export default defineConfig(() => {
  return config
})
