import type { UserConfig as ViteConfig } from 'vite'
import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { autoImports, components, i18n, layouts } from '@stacksjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
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

  build: {
    rollupOptions: {
      external: [
        'fs',
        'node:fs',
        'node:fs/promises',
        'node:module',
        'node:path',
        'node:process',
        'node:url',
        'node:assert',
        'node:v8',
        'node:util',
        '@iconify/utils',
        '@antfu/install-pkg',
      ],
    },
  },

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
      routesFolder: [p.resourcesPath('views/dashboard'), p.frameworkPath('defaults/views/dashboard')],
    }),

    layouts({
      extensions: ['vue', 'stx'],
      layoutsDirs: [p.layoutsPath('dashboard', { relative: true }), p.frameworkPath('defaults/layouts/dashboard')],
    }),

    autoImports(),
    components(),
    Unocss({
      configFile: p.uiPath('src/uno.config.ts'),
    }),
    // markdown(),
    // pwa(),
    // devtools(),
    i18n(),
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
