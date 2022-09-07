import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { library } from '../core/config'
import type { ViteConfig } from '../plugin'
import { atomicCssEngine, autoImports, components, defineConfig, envPrefix, i18n, inspect, uiEngine } from '../plugin'
import alias from '../core/alias'

const config: ViteConfig = {
  root: resolve(__dirname, '../../../components'),

  envPrefix,

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    inspect,

    uiEngine(),

    atomicCssEngine(),

    autoImports,

    components,

    i18n,
  ],

  build: componentsBuildOptions(),
}

export function componentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/components'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../../../config/components.ts'),
      name: library.packageName,
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
      external: ['vue'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
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
