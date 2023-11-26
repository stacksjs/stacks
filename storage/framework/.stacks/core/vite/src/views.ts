import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
// @ts-expect-error missing types - somehow, @stacksjs/vite-plugin-vue-layouts does not work
import Layouts from 'vite-plugin-vue-layouts'
import { autoImports } from './plugin/auto-imports'
import { layouts } from './plugin/layouts'
import { markdown } from './plugin/ui-engine'
import { components } from './plugin/components'
import { i18n } from './plugin/i18n'
import { fonts } from './plugin/fonts'
import { pwa } from './plugin/pwa'
import { cssEngine } from './plugin/css-engine'
import VueMacros from 'unplugin-vue-macros/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'unplugin-vue-router/vite'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  root: p.frameworkStoragePath('views'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  server: server({
    type: 'frontend',
  }),

  resolve: {
    alias,
  },

  plugins: [
    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
        }),
      },
    }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: p.frameworkStoragePath('types/router.d.ts'),
      routesFolder: [
        p.resourcesPath('views'),
      ],
      logs: config.app.debug || false,
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    layouts(),

    // https://github.com/antfu/unplugin-auto-import
    autoImports(),

    // https://github.com/antfu/unplugin-vue-components
    components(),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    cssEngine(),

    markdown(),

    // https://github.com/antfu/vite-plugin-pwa
    pwa(),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    i18n(),

    fonts(),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),
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

  build: {
    rollupOptions: {
      external: ['path', 'fs', 'net', 'tls', 'stream', 'node:process', 'constants', 'node:dns/promises', 'node:util'],
    }
  },
})
