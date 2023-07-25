import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueRouter from 'unplugin-vue-router/vite'
import { defu } from 'defu'
import type { Options } from 'unplugin-vue-router'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import type { AutoImportsOptions, ComponentOptions, InspectOptions } from '@stacksjs/types'
import { path as p, resolve } from '@stacksjs/path'
import Layouts from 'vite-plugin-vue-layouts'
import type { Options as LayoutOptions } from 'vite-plugin-vue-layouts'

export function inspect(options?: InspectOptions) {
  return Inspect(options)
}

export function layouts(options?: LayoutOptions) {
  const defaultOptions = {}

  const newOptions = defu(options, defaultOptions)

  return Layouts(newOptions)
}

export function components(options?: ComponentOptions): Plugin {
  const defaultOptions = {
    // also allow auto-loading markdown components
    extensions: ['vue', 'md'],
    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    dirs: [
      p.componentsPath(),
      // viewsPath(),
    ],
    dts: p.frameworkPath('types/components.d.ts'),
  }

  const newOptions = defu(options, defaultOptions)

  return Components(newOptions)
}

// https://github.com/posva/unplugin-vue-router
export function pages(options?: Options) {
  const defaultOptions = {
    extensions: ['.vue', '.md'],
  }

  const newOptions = defu(options, defaultOptions)

  return VueRouter(newOptions)
}

export function autoImports(options?: AutoImportsOptions): Plugin {
  const defaultOptions: AutoImportsOptions = {
    imports: [
      'vue', VueRouterAutoImports, 'vue/macros', 'pinia',
      // 'vitepress'
      // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      // { stacks: [''] },
    ],
    dirs: [
      // p.resourcesPath('functions'),
      // p.resourcesPath('components'),

      // auto imported utilities start here
      p.frameworkPath('src'), // here, we say that everything that lives here in .stacks/src/index.ts will be auto-imported
      // p.aiPath('src'),
      // p.arraysPath('src'),
      // p.authPath('src'),
      // p.cachePath('src'),
      // p.chatPath('src'),
      // p.cliPath('src'),
      // p.cloudPath('src'),
      // p.databasePath('src'),
      // p.datetimePath('src'),
      // p.desktopPath('src'),
      // p.errorHandlingPath('src'),
      // p.eventsPath('src'),
      // p.fakerPath('src'),
      // p.healthPath('src'),
      // p.lintPath('src'),
      // p.notificationsPath('src'),
      // p.objectsPath('src'),
      // p.ormPath('src'),
      // p.pathPath('src'),
      // p.paymentsPath('src'),
      // p.pushPath('src'),
      // p.queuePath('src'),
      // p.queryBuilderPath('src'),
      // p.realtimePath('src'),
      // p.routerPath('src'),
      // p.searchEnginePath('src'),
      // p.securityPath('src'),
      // p.signalsPath('src'),
      // p.smsPath('src'),
      // p.slugPath('src'),
      // p.storagePath('src'),
      // p.stringsPath('src'),
      // p.testingPath('src'),
      // p.utilsPath('src'),
      // p.validationPath('src'),
    ],
    dts: p.frameworkPath('types/auto-imports.d.ts'),
    vueTemplate: true,
    eslintrc: {
      enabled: false,
      // filepath: frameworkPath('.eslintrc-auto-import.json'),
    },
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}

export function cssEngine(isWebComponent = false) {
  return Unocss({
    configFile: p.uiPath('src/unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}

export function pwa() {
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

// export function i18n(options?: i18nOptions) {
//   const defaultOptions: i18nOptions = {
//     runtimeOnly: true,
//     compositionOnly: true,
//     include: [langPath('./**')],
//   }

//   const newOptions = defu(options, defaultOptions)

//   return VueI18n(newOptions)
// }

export function uiEngine(isWebComponent = false): Plugin {
  if (isWebComponent) {
    return Vue({
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    }) as Plugin
  }

  return Vue({
    include: [/\.vue$/, /\.md$/],
  }) as Plugin
}

// export function componentPreset(isWebComponent = false) {
//   return [
//     // inspect,
//     uiEngine(isWebComponent),
//     cssEngine(isWebComponent),
//     // autoImports,
//     // components,
//   ] satisfies PluginOption
// }

// const pagesPreset = (isWebComponent = false) => <PluginOption>[
//   //
// ]

// const functionsPreset = () => <PluginOption>[
//   //
// ]

export { resolve }
