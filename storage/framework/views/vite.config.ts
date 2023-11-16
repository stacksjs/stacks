import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'
import Layouts from '@stacksjs/vite-plugin-vue-layouts'
import { autoImports, components, cssEngine, pwa } from '@stacksjs/vite'
import UnoCSS from 'unocss/vite'
// import Markdown from 'unplugin-vue-markdown/vite'
// import VueMacros from 'unplugin-vue-macros/vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import LinkAttributes from 'markdown-it-link-attributes'
// import Shiki from 'markdown-it-shikiji'
import WebfontDownload from 'vite-plugin-webfont-dl'
import VueRouter from 'unplugin-vue-router/vite'

export default defineConfig({
  plugins: [
    // VueMacros({
    //   plugins: {
    //     vue: Vue({
    //       include: [/\.vue$/, /\.md$/],
    //     }),
    //   },
    // }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),

    // https://github.com/antfu/unplugin-auto-import
    autoImports(),

    // https://github.com/antfu/unplugin-vue-components
    components(),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    // cssEngine(),
    UnoCSS({
      configFile: p.corePath('vite/src/uno.config.ts'),
    }),

    // https://github.com/unplugin/unplugin-vue-markdown
    // Don't need this? Try vitesse-lite: https://github.com/antfu/vitesse-lite
    // Markdown({
    //   wrapperClasses: 'prose prose-sm m-auto text-left',
    //   headEnabled: true,
    //   async markdownItSetup(md) {
    //     md.use(LinkAttributes, {
    //       matcher: (link: string) => /^https?:\/\//.test(link),
    //       attrs: {
    //         target: '_blank',
    //         rel: 'noopener',
    //       },
    //     })
    //     md.use(await Shiki({
    //       defaultColor: false,
    //       themes: {
    //         light: 'vitesse-light',
    //         dark: 'vitesse-dark',
    //       },
    //     }))
    //   },
    // }),

    // https://github.com/antfu/vite-plugin-pwa
    // pwa(),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      include: [p.langPath('**')],
    }),

    // https://github.com/feat-agency/vite-plugin-webfont-dl
    WebfontDownload(),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    deps: {
      inline: ['@vue', '@vueuse', 'vue-demi'],
    },
  },

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
