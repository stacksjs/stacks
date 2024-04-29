import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import {
  autoImports,
  components,
  cssEngine,
  i18n,
  layouts,
  router,
} from '@stacksjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import VueMacros from 'unplugin-vue-macros/vite'
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
      ],
    },
  },

  root: p.frameworkPath('views/dashboard'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  optimizeDeps: {
    exclude: [
      'bun:test',
      'webpack',
      'chokidar',
      'fsevents',
      '@intlify/unplugin-vue-i18n',
      '@stacksjs/ui',
    ],
  },

  // server: server({
  //   type: 'admin',
  // }),

  resolve: {
    alias,
  },

  plugins: [
    VueMacros({
      plugins: {
        vue: Vue({
          include: /\.(stx|md)($|\?)/,
        }),
      },
    }),

    router({
      extensions: ['.stx', '.md'],
      dts: p.frameworkPath('types/dashboard-router.d.ts'),
      routesFolder: [p.resourcesPath('views/dashboard')],
      logs: config.app.debug || false,
    }),

    layouts({
      extensions: ['stx'],
      layoutsDirs: p.layoutsPath('dashboard', { relative: true }),
    }),
    autoImports(),
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

    crittersOptions: {
      reduceInlineStyles: false,
    },

    onFinished() {
      generateSitemap()
    },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
})
