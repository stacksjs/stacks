import type { ViteConfig } from '@stacksjs/types'
import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { autoImports, components, cssEngine, i18n, layouts } from '@stacksjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import generateSitemap from 'vite-ssg-sitemap'

// import { autoImports, components, cssEngine, devtools, i18n, layouts, markdown, pwa, router } from './stacks'
// import { fonts } from './plugin/fonts'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export const dashboardConfig: ViteConfig = {
  root: p.frameworkPath('views/dashboard'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.publicPath('**/*'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  server: {
    hmr: {
      overlay: false,
    },
  },

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
      layoutsDirs: [p.layoutsPath('dashboard', { relative: true }), p.frameworkPath('defaults/layouts/dashboard')],
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
}

export default dashboardConfig
