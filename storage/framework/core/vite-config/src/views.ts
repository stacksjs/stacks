import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import {
  autoImports,
  components,
  cssEngine,
  devtools,
  i18n,
  layouts,
  markdown,
  pwa,
  router,
} from '@stacksjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import VueMacros from 'unplugin-vue-macros/vite'
import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'

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

  root: p.frameworkPath('views/web'),
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

  server: server({
    type: 'frontend',
  }),

  resolve: {
    alias: {
      ...alias,
      '~/config/ai': p.projectConfigPath('ai.ts'),
      '~/config/analytics': p.projectConfigPath('analytics.ts'),
      '~/config/api': p.projectConfigPath('api.ts'),
      '~/config/app': p.projectConfigPath('app.ts'),
      '~/config/cache': p.projectConfigPath('cache.ts'),
      '~/config/cli': p.projectConfigPath('cli.ts'),
      '~/config/cloud': p.projectConfigPath('cloud.ts'),
      '~/config/database': p.projectConfigPath('database.ts'),
      '~/config/env': p.projectConfigPath('env.ts'),
      '~/config/dns': p.projectConfigPath('dns.ts'),
      '~/config/docs': p.projectConfigPath('docs.ts'),
      '~/config/email': p.projectConfigPath('email.ts'),
      '~/config/git': p.projectConfigPath('git.ts'),
      '~/config/hashing': p.projectConfigPath('hashing.ts'),
      '~/config/library': p.projectConfigPath('library.ts'),
      '~/config/logger': p.projectConfigPath('logger.ts'),
      '~/config/notification': p.projectConfigPath('notification.ts'),
      '~/config/payment': p.projectConfigPath('payment.ts'),
      '~/config/ports': p.projectConfigPath('ports.ts'),
      '~/config/queue': p.projectConfigPath('queue.ts'),
      '~/config/search-engine': p.projectConfigPath('search-engine.ts'),
      '~/config/security': p.projectConfigPath('security.ts'),
      '~/config/services': p.projectConfigPath('services.ts'),
      '~/config/storage': p.projectConfigPath('storage.ts'),
      '~/config/team': p.projectConfigPath('team.ts'),
      '~/config/ui': p.projectConfigPath('ui.ts'),
    },
  },

  plugins: [
    VueMacros({
      plugins: {
        vue: Vue({
          include: /\.(stx|vue|md)($|\?)/,
        }),
      },
    }),

    router(),
    layouts({
      extensions: ['stx', 'vue'],
      layoutsDirs: p.layoutsPath('', { relative: true }),
    }),
    autoImports(),
    components(),
    cssEngine(),
    markdown(),
    pwa(),
    devtools(),
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
