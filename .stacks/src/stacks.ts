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
import { defu } from 'defu'
import type { AutoImportsOptions, ComponentOptions, InspectOptions, LayoutOptions, MarkdownOptions, PagesOptions, i18nOptions } from '@stacksjs/types'
import { componentsPath, configPath, frameworkPath, functionsPath, langPath, pagesPath } from './helpers'

// it is important to note that path references within this file
// are relative to the ./build folder

function inspect(options?: InspectOptions) {
  return Inspect(options)
}

function preview() {
  return Preview
}

function layouts(options?: LayoutOptions) {
  return Layouts(options)
}

function components(options?: ComponentOptions) {
  const defaultOptions = {
    // also allow auto-loading markdown components
    extensions: ['vue', 'md'],
    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    dirs: [
      componentsPath(),
      pagesPath(),
    ],
    dts: frameworkPath('components.d.ts'),
  }

  const newOptions = defu(options, defaultOptions)

  return Components(newOptions)
}

// https://github.com/hannoeru/vite-plugin-pages
function pages(options?: PagesOptions) {
  const defaultOptions: PagesOptions = {
    extensions: ['vue', 'md'],
    dirs: [
      pagesPath(),
    ],
  }

  const newOptions = defu(options, defaultOptions)

  return Pages(newOptions)
}

function markdown(options?: MarkdownOptions) {
  const defaultOptions: MarkdownOptions = {
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
  }

  const newOptions = defu(options, defaultOptions)

  return Markdown(newOptions)
}

function autoImports(options?: AutoImportsOptions) {
  const defaultOptions: AutoImportsOptions = {
    imports: [
      'vue', 'vue-router', 'vue/macros', '@vueuse/core', '@vueuse/head', '@vueuse/math', 'vitest',
      { '@vueuse/shared': ['isClient', 'isDef', 'isBoolean', 'isFunction', 'isNumber', 'isString', 'isObject', 'isWindow', 'now', 'timestamp', 'clamp', 'noop', 'rand', 'isIOS', 'hasOwn'] },
      { 'collect.js': ['collect', 'Collection'] },
    ],
    dirs: [
      frameworkPath('generate/src'),
      frameworkPath('utils/src'),
      frameworkPath('security/src'),
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
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}

function atomicCssEngine(isWebComponent = false) {
  return Unocss({
    configFile: frameworkPath('src/unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}

function pwa() {
  return VitePWA({
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
}

function i18n(options?: i18nOptions) {
  const defaultOptions: i18nOptions = {
    runtimeOnly: true,
    compositionOnly: true,
    include: [langPath('./**')],
  }

  const newOptions = defu(options, defaultOptions)

  return VueI18n(newOptions)
}

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
