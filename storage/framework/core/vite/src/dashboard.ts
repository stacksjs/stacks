import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import VueMacros from 'unplugin-vue-macros/vite'
import { cssEngine, devtools, i18n, layouts, router } from './stacks'

// import { autoImports, components, cssEngine, devtools, i18n, layouts, markdown, pwa, router } from './stacks'

// import { fonts } from './plugin/fonts'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['path', 'fs', 'net', 'tls', 'stream', 'node:process', 'constants', 'node:dns/promises', 'node:util'],
    },
  },

  root: p.frameworkPath('views/dashboard'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [
    p.resourcesPath('assets/*'),
    p.resourcesPath('assets/**/*'),
  ],

  optimizeDeps: {
    exclude: ['bun:test', 'webpack', 'chokidar', 'fsevents', '@intlify/unplugin-vue-i18n', '@stacksjs/ui'],
  },

  server: server({
    type: 'dashboard',
  }),

  resolve: {
    alias,
  },

  plugins: [
    VueMacros({
      plugins: {
        vue: Vue({
          include: /\.(stx|vue|md)($|\?)/,
        }),
      },
    }),

    router('dashboard'),
    layouts({
      extensions: ['stx'],
      layoutsDirs: p.frameworkPath('views/dashboard/src/layouts'),
      defaultLayout: p.frameworkPath('views/dashboard/src/layouts/default.stx'),
    }, false),
    // autoImports(),
    // components(),
    cssEngine(),
    // markdown(),
    // pwa(),
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
