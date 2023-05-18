import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import type { PluginOption } from 'vite'
import Markdown from 'vite-plugin-vue-markdown'
import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shiki'
import { VitePWA } from 'vite-plugin-pwa'
import { defu } from 'defu'
import type { AutoImportsOptions, ComponentOptions, InspectOptions, LayoutOptions, MarkdownOptions, PagesOption } from '@stacksjs/types'
import { path as p, resolve } from '@stacksjs/path'

// it is important to note that path references within this file
// are relative to the ./build folder

function inspect(options?: InspectOptions) {
  return Inspect(options)
}

function layouts(options?: LayoutOptions) {
  return Layouts(options)
}

function components(options?: ComponentOptions): PluginOption {
  const defaultOptions = {
    // also allow auto-loading markdown components
    extensions: ['vue', 'md'],
    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    dirs: [
      p.componentsPath(),
      // pagesPath(),
    ],
    dts: p.frameworkPath('components.d.ts'),
  }

  const newOptions = defu(options, defaultOptions)

  return Components(newOptions)
}

// https://github.com/hannoeru/vite-plugin-pages
function pages(options?: PagesOption) {
  const defaultOptions: PagesOption = {
    extensions: ['vue', 'md'],
    dirs: [
      p.pagesPath(),
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
      { '@vueuse/shared': ['isClient', 'now', 'timestamp', 'clamp', 'noop', 'rand', 'isIOS', 'hasOwn'] },
    ],
    dirs: [
      p.functionsPath(),
      p.componentsPath(),
      p.projectPath('config'),

      // auto imported utilities start here
      p.aiPath('src'),
      p.arraysPath('src'),
      p.authPath('src'),
      p.authPath('src'),
      p.cachePath('src'),
      p.chatPath('src'),
      p.collectionsPath('src'),
      p.databasePath('src'),
      p.desktopPath('src'),
      p.emailPath('src'),
      p.errorHandlingPath('src'),
      p.eventsPath('src'),
      p.healthPath('src'),
      p.lintPath('src'),
      p.loggingPath('src'),
      p.notificationsPath('src'),
      p.objectsPath('src'),
      p.pathPath('src'),
      p.paymentsPath('src'),
      p.pushPath('src'),
      p.queuePath('src'),
      p.realtimePath('src'),
      p.routerPath('src'),
      p.searchEnginePath('src'),
      p.securityPath('src'),
      p.smsPath('src'),
      p.storagePath('src'),
      p.stringsPath('src'),
      p.tablesPath('src'),
      p.stringsPath('src'),
      p.testingPath('src'),
      p.uiPath('src'),
      p.utilsPath('src'),
      p.validationPath('src'),
    ],
    dts: p.frameworkPath('auto-imports.d.ts'),
    vueTemplate: true,
    eslintrc: {
      enabled: false,
      // filepath: frameworkPath('.eslintrc-auto-import.json'),
    },
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}

function cssEngine(isWebComponent = false) {
  return Unocss({
    configFile: p.uiPath('src/unocss.ts'),
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

// function i18n(options?: i18nOptions) {
//   const defaultOptions: i18nOptions = {
//     runtimeOnly: true,
//     compositionOnly: true,
//     include: [langPath('./**')],
//   }

//   const newOptions = defu(options, defaultOptions)

//   return VueI18n(newOptions)
// }

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

function componentPreset(isWebComponent = false) {
  return <PluginOption>[
    inspect,
    uiEngine(isWebComponent),
    cssEngine(isWebComponent),
    autoImports,
    components,
    markdown,
  ]
}

// const pagesPreset = (isWebComponent = false) => <PluginOption>[
//   //
// ]

// const functionsPreset = () => <PluginOption>[
//   //
// ]

export { resolve, componentPreset, uiEngine, autoImports, cssEngine, components, inspect, markdown, pages, pwa, layouts }
