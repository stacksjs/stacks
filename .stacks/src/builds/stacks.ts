import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../core'
import { autoImports, defineConfig } from '../core'
import alias from '../alias'

// if we build this, it needs to include everything

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
  },

  plugins: [
    autoImports,
  ],

  build: stacksBuildOptions(),
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})

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

        // if (format === 'iife')
        //     return `index.iife.js`

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
