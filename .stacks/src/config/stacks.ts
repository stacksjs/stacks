import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import alias from '../core/alias'
import { defineConfig } from '../plugin'
import type { ViteConfig } from '../plugin'

const config: ViteConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
  },

  build: stacksBuildOptions(),
}

export function stacksBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/stacks'),

    lib: {
      entry: resolve(__dirname, '../index.ts'),
      name: 'stacks',
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },
    },

    rollupOptions: {
      external: ['stacks'],
    },

    // sourcemap: true,
    // minify: false,
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
