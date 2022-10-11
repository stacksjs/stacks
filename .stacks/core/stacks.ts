import { resolve } from 'pathe'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Preview from 'vite-plugin-vue-component-preview'
import type { PluginOption } from 'vite'
import Markdown from 'vite-plugin-vue-markdown'
import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shiki'
import { VitePWA } from 'vite-plugin-pwa'
import { componentsPath, configPath, frameworkPath, functionsPath, langPath, pagesPath } from './utils/helpers'

// it is important to note that path references within this file
// are relative to the ./build folder

const inspect = Inspect()
const preview = Preview
const layouts = Layouts()

function components() {
  return Components({
  // also allow auto-loading markdown components
    extensions: ['vue', 'md'],
    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    dirs: [
      componentsPath(),
      pagesPath(),
    ],
    dts: frameworkPath('components.d.ts'),
  })
}

// https://github.com/hannoeru/vite-plugin-pages
const pages = Pages({
  extensions: ['vue', 'md'],
  dirs: [
    pagesPath(),
  ],
})

const markdown = Markdown({
  wrapperClasses: 'prose prose-sm m-auto text-left',
  headEnabled: true,
  markdownItSetup(md) {
    // https://prismjs.com/
    md.use(Shiki, {
      theme: 'nord',
    })
    md.use(LinkAttributes, {
      matcher: (link: string) => /^https?:\/\//.test(link),
      attrs: {
        target: '_blank',
        rel: 'noopener',
      },
    })
  },
})

const autoImports = AutoImport({
  imports: [
    'vue', 'vue-router', 'vue/macros', '@vueuse/core', '@vueuse/head', '@vueuse/math', 'vitest',
    { '@vueuse/shared': ['isClient', 'isDef', 'isBoolean', 'isFunction', 'isNumber', 'isString', 'isObject', 'isWindow', 'now', 'timestamp', 'clamp', 'noop', 'rand', 'isIOS', 'hasOwn'] },
    { 'collect.js': ['collect'] },
  ],
  dirs: [
    frameworkPath('core/generate'),
    frameworkPath('core/utils'),
    frameworkPath('core/security'),
    functionsPath(),
    componentsPath(),
    configPath(),
  ],
  dts: frameworkPath('auto-imports.d.ts'),
  vueTemplate: true,
  eslintrc: {
    enabled: false,
    // filepath: frameworkPath('.eslintrc-auto-import.json'),
  },
})

function atomicCssEngine(isWebComponent = false) {
  return Unocss({
    configFile: frameworkPath('core/unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}

const pwa = VitePWA({
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
})

const i18n = VueI18n({
  runtimeOnly: true,
  compositionOnly: true,
  include: [langPath('./**')],
})

function uiEngine(isWebComponent = false) {
  if (isWebComponent) {
    return Vue({
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    })
  }

  return Vue({
    include: [/\.vue$/, /\.md$/],
  })
}

const componentPreset = (isWebComponent = false) => <PluginOption>[
  inspect,
  uiEngine(isWebComponent),
  atomicCssEngine(isWebComponent),
  autoImports,
  components,
  markdown,
]

// const pagesPreset = (isWebComponent = false) => <PluginOption>[
//   //
// ]

// const functionsPreset = () => <PluginOption>[
//   //
// ]

export { resolve, componentPreset, uiEngine, autoImports, atomicCssEngine, components, inspect, markdown, pages, pwa, preview, layouts, i18n }
// export { resolve, componentPreset, pagesPreset, functionsPreset, uiEngine, autoImports, atomicCssEngine, components, inspect, markdown, pages, pwa, preview, layouts, i18n }
