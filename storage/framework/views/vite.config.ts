import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import generateSitemap from 'vite-ssg-sitemap'
// @ts-ignore - no types
import Layouts from 'vite-plugin-vue-layouts'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import Unocss from 'unocss/vite'
import WebfontDownload from 'vite-plugin-webfont-dl'
import VueRouter from 'unplugin-vue-router/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import Markdown from 'unplugin-vue-markdown/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shikiji'

export default defineConfig({
  root: p.viewsPath(),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.publicPath(),

  resolve: {
    alias,
  },

  server: server({
    type: 'frontend',
  }),

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
      routesFolder: p.routesPath(),
      extensions: ['.vue', '.md'],
      dts: p.frameworkStoragePath('types/router.d.ts'),
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDir: p.resourcesPath('layouts'),
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: [
        'vue',
        'vue-i18n',
        VueRouterAutoImports,
        {
          // add any other imports you were relying on
          'vue-router/auto': ['useLink'],
        },
        'pinia',
        unheadVueComposablesImports,
        // 'vitepress'
        // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
        // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
        // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      ],

      dirs: [
        p.resourcesPath('functions'),
        p.resourcesPath('stores'),
        p.resourcesPath('components'),

        // here, we say that everything that lives here in .stacks/src/index.ts will be auto-imported
        p.frameworkPath('src'),
      ],

      dts: p.frameworkStoragePath('types/auto-imports.d.ts'),
      vueTemplate: true,
      eslintrc: {
        enabled: false,
        // filepath: frameworkPath('.eslintrc-auto-import.json'),
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // also allow auto-loading markdown components
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dirs: [
        p.componentsPath(),
        // viewsPath(),
      ],
      dts: p.frameworkStoragePath('types/components.d.ts'),
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss({
      configFile: p.corePath('vite/src/uno.config.ts'),
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
      include: [p.projectPath('lang/**')],
    }),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    WebfontDownload(),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),
  ],

  // https://github.com/vitest-dev/vitest
  // test: {
  //   include: ['test/**/*.test.ts'],
  //   environment: 'jsdom',
  // },

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
