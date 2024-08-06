import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { components, cssEngine, i18n, layouts } from '@stacksjs/vite-plugin'
import { unheadVueComposablesImports as VueHeadImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'

// import { autoImports, components, cssEngine, devtools, i18n, layouts, markdown, pwa, router } from './stacks'

// import { fonts } from './plugin/fonts'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'path',
        'fs',
        'net',
        'tls',
        'stream',
        'node:process',
        'constants',
        'node:dns/promises',
        'node:util',
        '@stacksjs/cli',
        'unplugin-icons',
        '@iconify/utils',
        '@jsdevtools/ez-spawn',
      ],
    },
  },

  root: p.frameworkPath('views/dashboard'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.publicPath('**/*'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  optimizeDeps: {
    exclude: ['bun:test', 'webpack', 'chokidar', 'fsevents', '@intlify/unplugin-vue-i18n', '@stacksjs/ui'],
  },

  // server: server({
  //   type: 'admin',
  // }),

  resolve: {
    alias,
  },

  plugins: [
    Vue({
      include: /\.(stx|vue|md)($|\?)/,
    }),

    VueRouter({
      extensions: ['.stx', '.vue', '.md'],
      dts: p.frameworkPath('types/dashboard-router.d.ts'),
      routesFolder: [p.resourcesPath('views/dashboard')],
      logs: config.app.debug || false,
    }),

    layouts({
      extensions: ['vue', 'stx'],
      layoutsDirs: p.layoutsPath('dashboard', { relative: true }),
    }),

    // autoImports(),
    AutoImport({
      include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
      imports: [
        'pinia',
        'vue',
        'vue-i18n',
        // '@vueuse/core',
        // 'vitepress'
        // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
        // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
        // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
        VueHeadImports,
        VueRouterAutoImports,
        {
          'vue-router/auto': ['useLink'],
        },
      ],

      dts: p.frameworkPath('types/auto-imports.d.ts'),

      dirs: [p.userLibsPath('components'), p.userLibsPath('functions'), p.resourcesPath('stores'), p.corePath()],

      vueTemplate: true,

      // eslintrc: {
      //   enabled: true,
      //   filepath: '../../.eslintrc-auto-import.json', // Default `./.eslintrc-auto-import.json`
      //   globalsPropValue: true, // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
      // },
    }),

    components(),
    cssEngine(),
    // markdown(),
    // pwa(),
    // devtools(),
    i18n(),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    // fonts(),
    // webfontDownload(),
  ],

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',

    // crittersOptions: {
    //   reduceInlineStyles: false,
    // },

    onFinished() {
      generateSitemap()
    },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
})
