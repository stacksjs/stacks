import type { UserConfig as ViteConfig } from 'vite'
import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { cssEngine, i18n, layouts, router } from '@stacksjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'

// import { autoImports, components, cssEngine, devtools, i18n, layouts, markdown, pwa, router } from './stacks'
// import { fonts } from './plugin/fonts'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export const systemTrayConfig: ViteConfig = {
  build: {
    rollupOptions: {
      external: ['path', 'fs', 'net', 'tls', 'stream', 'node:process', 'constants', 'node:dns/promises', 'node:util'],
    },
  },

  root: p.frameworkPath('system-tray'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  assetsInclude: [p.publicPath('**/*'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

  optimizeDeps: {
    exclude: ['bun:test', 'webpack', 'chokidar', 'fsevents', '@intlify/unplugin-vue-i18n', '@stacksjs/ui'],
  },

  server: server({
    type: 'system-tray',
  }),

  resolve: {
    alias,
  },

  plugins: [
    Vue({
      include: /\.(stx|md)($|\?)/,
    }),

    router({
      extensions: ['.stx', '.vue', '.md'],
      dts: p.frameworkPath('types/system-tray-router.d.ts'),
      routesFolder: [p.resourcesPath('views/system-tray')],
      logs: config.app.debug || false,
    }),

    layouts({
      extensions: ['stx'],
      layoutsDirs: [p.layoutsPath('system-tray', { relative: true }), p.frameworkPath('defaults/layouts/system-tray')],
    }),
    // autoImports(),
    // components(),
    cssEngine(),
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

export default systemTrayConfig
