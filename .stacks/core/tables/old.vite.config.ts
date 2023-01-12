import { resolve } from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import PresetIcons from '@unocss/preset-icons'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    // dedupe: ['vue'],
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },

  optimizeDeps: {
    exclude: ['vue-demi'],
  },

  plugins: [
    Vue(),

    Unocss({
      mode: 'vue-scoped',
      presets: [
        PresetIcons({
          prefix: 'i-',
          extraProperties: {
            'display': 'inline-block',
            'vertical-align': 'middle',
          },
        }),
      ],
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', '@vueuse/core', {
        '~/composables/dark': ['isDark', 'toggleDark'],
        '~/composables/table': ['useTable'],
      }],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: ['src/components'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'table-vue',
      fileName: format => `table-vue.${format}.js`,
    },

    rollupOptions: {
      external: ['vue', 'vue-demi'],
      output: {
        // exports: 'named',
        globals: {
          'vue': 'Vue',
          'vue-demi': 'vue-demi',
        },
      },
    },

    sourcemap: true,
    minify: true,
  },

  test: {
    include: ['tests/**/*.test.ts'],
    // environment: 'jsdom',
    deps: {
      inline: ['@vue', '@vueuse', 'vue-demi'],
    },
  },
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
