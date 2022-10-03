import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../types'
import { functionsLibrary } from '../../../config/library'
import { autoImports } from '..'
import alias from '../alias'
import { _dirname } from '../utils'

const config: ViteConfig = {
  root: resolve(_dirname, '../../../components'),

  envPrefix: 'STACKS_',

  resolve: {
    // dedupe: ['vue'],
    alias,
  },

  // optimizeDeps: {
  //   exclude: ['vue'],
  // },

  plugins: [
    autoImports,
  ],

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../functions/dist'),
    emptyOutDir: true,
    sourcemap: functionsLibrary.shouldGenerateSourcemap,
    lib: {
      entry: resolve(_dirname, '../build/entries/functions.ts'),
      name: functionsLibrary.name,
      formats: functionsLibrary.shouldBuildIife ? ['cjs', 'es', 'iife'] : ['cjs', 'es'],
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

    // rollupOptions: {
    // external: ['vue'],
    // output: {
    //   // exports: 'named',
    //   globals: {
    //     vue: 'Vue',
    //   },
    // },
    // },

    // minify: false,
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
