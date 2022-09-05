import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import Inspect from 'vite-plugin-inspect'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Unocss from 'unocss/vite'
import { library } from '../core/config'
import type { ViteConfig } from '../core'
import alias from '../core/alias'
import { defineConfig } from '../core'

// https://vitejs.dev/config/
const config: ViteConfig = {
  root: resolve(__dirname, '../../../components'),

  envPrefix: 'STACKS_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core'],
  },

  plugins: [
    Inspect(),

    // UiEngine,
    Vue({
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    }),

    Unocss({
      configFile: resolve(__dirname, '../unocss.ts'),
      mode: 'shadow-dom', // or 'vue-scoped'
    }),

    AutoImport({
      imports: ['vue', 'vue-i18n', '@vueuse/core'],
      dirs: [
        resolve(__dirname, '../../../functions'),
        resolve(__dirname, '../../../components'),
        resolve(__dirname, '../../../config'),
      ],
      dts: resolve(__dirname, '../../auto-imports.d.ts'),
      vueTemplate: true,
    }),

    Components({
      dirs: [resolve(__dirname, '../../../components')],
      extensions: ['vue'],
      dts: '../../components.d.ts',
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: [resolve(__dirname, '../../../lang/**')],
    }),
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/elements'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../../../config/components.ts'),
      name: library.webComponentsLibraryName,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },

      // sourcemap: true,
      // minify: false,;
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
