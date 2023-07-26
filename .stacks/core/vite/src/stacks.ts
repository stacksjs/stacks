import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import Pages from 'vite-plugin-pages'
import mkcert from 'vite-plugin-mkcert'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defu } from 'defu'
import type { ComponentOptions, InspectOptions, PagesOption } from '@stacksjs/types'
import { path as p, resolve } from '@stacksjs/path'

export { uiEngine } from './plugin/ui-engine'
export { autoImports } from './plugin/auto-imports'

// import Layouts from 'vite-plugin-vue-layouts'

export function inspect(options?: InspectOptions) {
  console.log('running inspect')
  return Inspect(options)
}

// export function layouts(options?: LayoutOptions) {
//   return Layouts(options)
// }

export function components(options?: ComponentOptions): Plugin {
  console.log('running components')

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

// https://github.com/hannoeru/vite-plugin-pages
export function pages(options?: PagesOption): Plugin {
  const defaultOptions = {
    extensions: ['vue', 'md'],
    dirs: [
      p.viewsPath(),
    ],
  }

  const newOptions = defu(options, defaultOptions)

  return Pages(newOptions)
}

export function cssEngine(isWebComponent = false) {
  console.log('running cssEngine')

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

export function sslCertificate(): Plugin {
  console.log('running sslCertificate')

  return mkcert({
    hosts: ['localhost', 'stacks.test', 'api.stacks.test', 'admin.stacks.test', 'libs.stacks.test', 'docs.stacks.test'],
    autoUpgrade: true,
    savePath: p.frameworkPath('certs/components'),
    // keyFileName: library.name ? `library-${library.name}-key.pem` : 'library-key.pem',
    // certFileName: library.name ? `library-${library.name}-cert.pem` : 'library-cert.pem',
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
