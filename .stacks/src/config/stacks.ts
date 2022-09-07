import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import alias from '../core/alias'
import { defineConfig } from '../core'
import type { ViteConfig } from '../core'

export const inspect = Inspect()

export const components = Components({
  dirs: [resolve(__dirname, '../../../components')],
  extensions: ['vue'],
  dts: '../../components.d.ts',
})

export const autoImports = AutoImport({
  imports: ['vue', 'vue-i18n', '@vueuse/core', 'vitest', { 'collect.js': ['collect'] }],
  dirs: [
    resolve(__dirname, '../../../functions'),
    resolve(__dirname, '../../../components'),
    resolve(__dirname, '../../../config'),
  ],
  dts: resolve(__dirname, '../../auto-imports.d.ts'),
  vueTemplate: true,
})

// https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
export const i18n = VueI18n({
  runtimeOnly: true,
  compositionOnly: true,
  globalSFCScope: true,
  include: [resolve(__dirname, '../../../lang/**')],
})

export function atomicCssEngine(isWebComponent = false) {
  if (isWebComponent) {
    return Unocss({
      configFile: resolve(__dirname, '../core/unocss.ts'),
      mode: 'shadow-dom',
    })
  }

  return Unocss({
    configFile: resolve(__dirname, '../core/unocss.ts'),
    mode: 'vue-scoped',
  })
}

export function uiEngine(isWebComponent = false) {
  if (isWebComponent) {
    return Vue({
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    })
  }

  return Vue()
}

export const envPrefix = 'STACKS_'

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
      entry: resolve(__dirname, '../../index.ts'),
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
