import { resolve } from 'node:path'
import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { unheadVueComposablesImports as VueHeadImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import CleanCSS from 'clean-css'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'

const cleanCssInstance = new CleanCSS({})
function minify(code: string) {
  return cleanCssInstance.minify(code).styles
}

let cssCodeStr = ''

export default defineConfig(({ command, mode }) => {
  const userConfig: UserConfig = {
    optimizeDeps: {
      exclude: ['fsevents'],
    },
  }

  const commonPlugins = [
    Vue({
      include: /\.(stx|vue|md)($|\?)/,
    }),

    UnoCSS(),

    Components({
      extensions: ['stx', 'vue', 'md'],
      include: /\.(stx|vue|md)($|\?)/,
      resolvers: [
        IconsResolver({
          prefix: '',
        }),
      ],
    }),

    Icons(),

    AutoImport({
      include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
      imports: [
        'pinia',
        'vue',
        'vue-i18n',
        VueHeadImports,
        VueRouterAutoImports,
        {
          'vue-router/auto': ['useLink'],
        },
      ],

      // dts: p.frameworkPath('types/auto-imports.d.ts'),

      vueTemplate: true,
    }),
  ]

  if (mode === 'lib') {
    userConfig.build = {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'StacksNotification',
        fileName: 'stacks-notification',
      },
      outDir: 'dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      sourcemap: true,
      rollupOptions: {
        external: ['vue', '@stacksjs/utils', 'fsevents'],
        output: [
          // {
          //   format: 'cjs',
          //   entryFileNames: `stacks-notification.cjs`,
          // },
          {
            format: 'es',
            entryFileNames: `index.js`,
            preserveModules: false,
          },
        ],
      },
    }
    userConfig.plugins = [
      ...commonPlugins,
      {
        name: 'inline-css',
        transform(code, id) {
          const isCSS = (path: string) => /\.css$/.test(path)
          if (!isCSS(id)) return

          const cssCode = minify(code)
          cssCodeStr = cssCode
          return {
            code: '',
            map: { mappings: '' },
          }
        },
        renderChunk(code, { isEntry }) {
          if (!isEntry) return

          return {
            code: `\
            function __insertCSSStacksNotification(code) {
              if (!code || typeof document == 'undefined') return
              let head = document.head || document.getElementsByTagName('head')[0]
              let style = document.createElement('style')
              style.type = 'text/css'
              head.appendChild(style)
              ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
            }\n
            __insertCSSStacksNotification(${JSON.stringify(cssCodeStr)})
            \n ${code}`,
            map: { mappings: '' },
          }
        },
      },
    ]
  }

  return {
    resolve: {
      '~/config/env': p.projectConfigPath('env.ts'),
      '~/config/errors': p.projectConfigPath('errors.ts'),

      ...alias,
    },
    plugins: [...commonPlugins],
    ...userConfig,
  }
})
