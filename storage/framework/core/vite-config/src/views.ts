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
import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'

// import { fonts } from './plugin/fonts'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'stacks',
        'fsevents',
        'sharp',
        '@stacksjs/router',
        '@stacksjs/orm',
        '@stacksjs/dns',
        '@stacksjs/build',
        '@stacksjs/database',
        '@stacksjs/cloud',
        '@stacksjs/buddy',
        'storage/framework/core',
      ],
    },
  },

  root: p.frameworkPath('views/web'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.publicPath('**'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  optimizeDeps: {
    exclude: [
      '@stacksjs/ui',
      '@stacksjs/api',
      '@stacksjs/router',
      '@stacksjs/database',
      'stacks',
      'fsevents',
      'sharp',
      '@stacksjs/orm',
      '@stacksjs/dns',
      '@stacksjs/build',
      '@stacksjs/cloud',
      '@stacksjs/sms',
      '@stacksjs/buddy',
      'storage/framework/core',
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
      '~/config/app': p.projectConfigPath('app.ts'),
      '~/config/cache': p.projectConfigPath('cache.ts'),
      '~/config/cli': p.projectConfigPath('cli.ts'),
      '~/config/cloud': p.projectConfigPath('cloud.ts'),
      '~/config/database': p.projectConfigPath('database.ts'),
      '~/config/env': p.projectConfigPath('env.ts'),
      '~/config/errors': p.projectConfigPath('errors.ts'),
      '~/config/dns': p.projectConfigPath('dns.ts'),
      '~/config/docs': p.projectConfigPath('docs.ts'),
      '~/config/email': p.projectConfigPath('email.ts'),
      '~/config/git': p.projectConfigPath('git.ts'),
      '~/config/hashing': p.projectConfigPath('hashing.ts'),
      '~/config/library': p.projectConfigPath('library.ts'),
      '~/config/logging': p.projectConfigPath('logging.ts'),
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
    Vue({
      include: /\.(stx|vue|md)($|\?)/,
    }),

    router({
      type: 'views',
    }),

    layouts({
      extensions: ['stx', 'vue'],
      layoutsDirs: p.layoutsPath('', { relative: true }),
    }),

    autoImports(),
    // components(),
    // cssEngine(),
    // markdown(),
    pwa(),
    // devtools(),
    // i18n(),

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

    includedRoutes(paths, routes) {
      // exclude all the route paths that contains 'errors', 'system-tray', or 'dashboard'
      return paths.filter((i) => !i.includes('errors') && !i.includes('system-tray') && !i.includes('dashboard'))
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
