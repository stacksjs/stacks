import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import Layouts from 'vite-plugin-vue-layouts'

const projectRoot = resolve(__dirname, '../../../..')
const frameworkRoot = resolve(__dirname, '../..')

export default defineConfig({
  root: __dirname,
  envDir: projectRoot,
  envPrefix: 'FRONTEND_',
  publicDir: resolve(projectRoot, 'public'),

  resolve: {
    alias: {
      '~/': `${resolve(projectRoot)}/`,
      '@/': `${resolve(projectRoot, 'resources')}/`,
      '#components/': `${resolve(frameworkRoot, 'defaults/components')}/`,
      '#views/': `${resolve(frameworkRoot, 'defaults/views')}/`,
      '#layouts/': `${resolve(frameworkRoot, 'defaults/layouts')}/`,
    },
  },

  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
  },

  plugins: [
    VueRouter({
      routesFolder: [
        {
          src: resolve(frameworkRoot, 'defaults/views/dashboard'),
          path: 'dashboard/',
        },
      ],
      dts: resolve(__dirname, 'src/types/typed-router.d.ts'),
    }),

    vue({
      include: [/\.vue$/, /\.stx$/],
    }),

    Layouts({
      layoutsDirs: resolve(frameworkRoot, 'defaults/layouts/dashboard'),
      defaultLayout: 'default',
    }),

    AutoImport({
      imports: [
        'vue',
        '@vueuse/head',
        '@vueuse/core',
        VueRouterAutoImports,
        {
          pinia: ['defineStore', 'storeToRefs'],
        },
      ],
      dts: resolve(__dirname, 'src/types/auto-imports.d.ts'),
      dirs: [
        resolve(frameworkRoot, 'defaults/functions'),
        resolve(__dirname, 'src/composables'),
        resolve(__dirname, 'src/stores'),
      ],
      vueTemplate: true,
    }),

    Components({
      dirs: [
        resolve(frameworkRoot, 'defaults/components'),
        resolve(__dirname, 'src/components'),
      ],
      extensions: ['vue', 'stx'],
      include: [/\.vue$/, /\.vue\?vue/, /\.stx$/],
      dts: resolve(__dirname, 'src/types/components.d.ts'),
    }),

    UnoCSS(),
  ],

  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      '@vueuse/core',
      '@vueuse/head',
      'pinia',
    ],
    exclude: ['vue-demi'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'node:fs',
        'node:path',
        'node:process',
        'node:url',
      ],
    },
  },

  clearScreen: false,
})
