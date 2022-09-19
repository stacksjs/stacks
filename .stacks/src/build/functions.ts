import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import typescript2 from 'rollup-plugin-typescript2'
import type { ViteConfig } from '../types'
import { functionsLibrary } from '../../../config/library'
import { autoImports, inspect } from '..'
import alias from '../core/alias'
import { _dirname } from '../core/fs'

const config: ViteConfig = {
  root: resolve(_dirname, '../../../components'),

  envPrefix: 'STACKS_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  // optimizeDeps: {
  //   exclude: ['vue'],
  // },

  plugins: [
    inspect,

    autoImports,

    {
      ...typescript2({
        clean: true,
        useTsconfigDeclarationDir: true,
        tsconfig: resolve(_dirname, '../../../tsconfig.json'),
      }),
      apply: 'build',
    },
  ],

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../functions/dist'),

    emptyOutDir: true,

    lib: {
      entry: resolve(_dirname, '../../functions/index.ts'),
      name: functionsLibrary.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

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
