import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { config } from '@stacksjs/config'
// @ts-expect-error missing types
import Layouts from 'vite-plugin-vue-layouts'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'
import Shiki from 'markdown-it-shikiji'
import WebfontDownload from 'vite-plugin-webfont-dl'
import VueRouter from 'unplugin-vue-router/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'

// const isMaintenanceMode = config.app.maintenanceMode
// const maintenancePath = isMaintenanceMode ? '' : './maintenance'

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['path', 'fs', 'net', 'tls', 'stream', 'node:process', 'constants', 'node:dns/promises', 'node:util'],
    }
  },

  // define: {
  //   'process.env': {
  //     APP_NAME: JSON.stringify(process.env.APP_NAME),
  //     APP_ENV: JSON.stringify(process.env.APP_ENV),
  //     APP_KEY: JSON.stringify(process.env.APP_KEY),
  //     APP_DEBUG: JSON.stringify(process.env.APP_DEBUG),
  //     APP_URL: JSON.stringify(process.env.APP_URL),
  //     APP_PORT: JSON.stringify(process.env.APP_PORT),
  //     APP_MAINTENANCE: JSON.stringify(process.env.APP_MAINTENANCE),
  //     DB_CONNECTION: JSON.stringify(process.env.DB_CONNECTION),
  //     DB_HOST: JSON.stringify(process.env.DB_HOST),
  //     DB_PORT: JSON.stringify(process.env.DB_PORT),
  //     DB_DATABASE: JSON.stringify(process.env.DB_DATABASE),
  //     DB_USERNAME: JSON.stringify(process.env.DB_USERNAME),
  //     DB_PASSWORD: JSON.stringify(process.env.DB_PASSWORD),
  //     AWS_ACCESS_KEY_ID: JSON.stringify(process.env.AWS_ACCESS_KEY_ID),
  //     AWS_SECRET_ACCESS_KEY: JSON.stringify(process.env.AWS_SECRET_ACCESS_KEY),
  //     AWS_DEFAULT_PASSWORD: JSON.stringify(process.env.AWS_DEFAULT_PASSWORD),
  //     AWS_REGION: JSON.stringify(process.env.AWS_REGION),
  //     MAIL_MAILER: JSON.stringify(process.env.MAIL_MAILER),
  //     MAIL_HOST: JSON.stringify(process.env.MAIL_HOST),
  //     MAIL_PORT: JSON.stringify(process.env.MAIL_PORT),
  //     MAIL_USERNAME: JSON.stringify(process.env.MAIL_USERNAME),
  //     MAIL_PASSWORD: JSON.stringify(process.env.MAIL_PASSWORD),
  //     MAIL_ENCRYPTION: JSON.stringify(process.env.MAIL_ENCRYPTION),
  //     MAIL_FROM_NAME: JSON.stringify(process.env.MAIL_FROM_NAME),
  //     MAIL_FROM_ADDRESS: JSON.stringify(process.env.MAIL_FROM_ADDRESS),
  //     SEARCH_ENGINE_DRIVER: JSON.stringify(process.env.SEARCH_ENGINE_DRIVER),
  //     MEILISEARCH_HOST: JSON.stringify(process.env.MEILISEARCH_HOST),
  //     MEILISEARCH_KEY: JSON.stringify(process.env.MEILISEARCH_KEY),
  //     FRONTEND_APP_ENV: JSON.stringify(process.env.FRONTEND_APP_ENV),
  //     FRONTEND_APP_URL: JSON.stringify(process.env.FRONTEND_APP_URL),
  //   },
  // },

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
    Layouts({
      layoutsDir: p.resourcesPath('layouts'),
      defaultLayout: p.resourcesPath('layouts/default.vue'),
      exclude: [
        p.resourcesPath('layouts/mails'),
      ],
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: [
        'vue',
        'vue-i18n',
        '@vueuse/head',
        '@vueuse/core',
        VueRouterAutoImports,
        {
          // add any other imports you were relying on
          'vue-router/auto': ['useLink'],
        },
      ],
      dts: p.frameworkStoragePath('types/auto-imports.d.ts'),
      dirs: [
        p.resourcesPath('functions'),
        p.resourcesPath('stores'),
      ],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // allow auto load markdown components under `./resources/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: p.frameworkStoragePath('types/components.d.ts'),
      dirs: [
        p.resourcesPath('components'),
      ],
    }),

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
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      include: [
        p.resolve(__dirname, '../../../../../../lang/**')
      ],
    }),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    WebfontDownload(),

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
