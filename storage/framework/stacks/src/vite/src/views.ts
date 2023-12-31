import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'

// import { i18n } from './plugin/i18n'

// import AutoImport from 'unplugin-auto-import/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'
import Shiki from 'markdown-it-shikiji'
import VueRouter from 'unplugin-vue-router/vite'

// import { fonts } from './plugin/fonts'
import { layouts } from './plugin/layouts'
import { autoImports } from './plugin/auto-imports'
import { components } from './plugin/components'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['path', 'fs', 'net', 'tls', 'stream', 'node:process', 'constants', 'node:dns/promises', 'node:util'],
    },
  },

  root: p.frameworkStoragePath('views'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  optimizeDeps: {
    exclude: ['bun:test', 'webpack', 'chokidar', 'fsevents', '@intlify/unplugin-vue-i18n', '@stacksjs/ui'],
  },

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
          include: [/\.stx$/, /\.vue$/, /\.md$/],
        }),
      },
    }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.stx', '.md'],
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
    Unocss({
      configFile: p.uiPath('src/uno.config.ts'),
    }),

    // https://github.com/unplugin/unplugin-vue-markdown
    Markdown({
      wrapperClasses: 'prose prose-sm m-auto text-left',
      headEnabled: true,
      async markdownItSetup(md) {
        md.use(LinkAttributes, {
          matcher: (link: string) => /^https?:\/\//.test(link),
          attrs: {
            target: '_blank',
            rel: 'noopener',
          },
        })
        md.use(await Shiki({
          defaultColor: false,
          themes: {
            light: 'vitesse-light',
            dark: 'vitesse-dark',
          },
        }))
      },
    }),

    // https://github.com/antfu/vite-plugin-pwa
    VitePWA({
      srcDir: p.publicPath(),
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
      manifest: {
        name: 'Stacks',
        short_name: 'Stacks',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    // i18n(),
    // VueI18n({
    //   runtimeOnly: true,
    //   compositionOnly: true,
    //   fullInstall: true,
    //   include: [
    //     p.resolve(__dirname, '../../../../../../lang/**'),
    //   ],
    // }),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    // fonts(),
    // webfontDownload(),

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
})
