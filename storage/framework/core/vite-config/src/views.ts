import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import {
  autoImports,
  components,
  cssEngine,
  devtools,
  fonts,
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
      external: ['fsevents', 'tinyexec', '@iconify/utils', '@antfu/install-pkg', 'local-pkg', 'mlly', 'fs'],
    },
  },

  root: p.frameworkPath('views/web'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.publicPath('**'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  optimizeDeps: {
    exclude: ['vue'],
  },

  server: server({
    type: 'frontend',
  }),

  resolve: {
    alias,
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
    components(),
    cssEngine(),
    markdown(),
    pwa(),
    devtools(),
    i18n(),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    fonts(),
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
