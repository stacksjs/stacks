import type { UserConfig } from 'vite'
import { resolve } from 'node:path'
import { alias } from '@stacksjs/alias'
import Vue from '@vitejs/plugin-vue'
import CleanCSS from 'clean-css'
import UnoCSS from 'unocss/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

function minify(code: string) {
  const cleanCssInstance = new CleanCSS({})
  return cleanCssInstance.minify(code).styles
}

export default defineConfig(({ mode }) => {
  let cssCodeStr = ''
  const userConfig: UserConfig = {}

  const commonPlugins = [
    Vue({
      include: /\.(stx|vue|md)($|\?)/,
    }),

    UnoCSS({
      mode: 'vue-scoped',
    }),

    Components({
      extensions: ['stx', 'vue', 'md'],
      include: /\.(stx|vue|md)($|\?)/,
      resolvers: [
        IconsResolver({
          prefix: '',
          enabledCollections: ['heroicons'],
        }),
      ],
      dts: true,
    }),

    Icons({
      autoInstall: true,
      compiler: 'vue3',
    }),
  ]

  if (mode === 'lib') {
    userConfig.build = {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'StacksStepper',
        fileName: 'index',
      },
      outDir: 'dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      sourcemap: true,
      rollupOptions: {
        external: ['vue', '@heroicons/vue', 'unocss'],
        output: [
          {
            format: 'es',
            entryFileNames: 'index.js',
            globals: {
              'vue': 'Vue',
              '@heroicons/vue': 'HeroIcons',
              'unocss': 'UnoCSS',
            },
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
          if (!isCSS(id))
            return

          const cssCode = minify(code)
          cssCodeStr = cssCode
          return {
            code: '',
            map: { mappings: '' },
          }
        },
        renderChunk(code, { isEntry }) {
          if (!isEntry)
            return

          return {
            code: `\
            function __insertCSSStacksStepper(code) {
              if (!code || typeof document == 'undefined') return
              let head = document.head || document.getElementsByTagName('head')[0]
              let style = document.createElement('style')
              style.type = 'text/css'
              head.appendChild(style)
              ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
            }\n
            __insertCSSStacksStepper(${JSON.stringify(cssCodeStr)})
            \n ${code}`,
            map: { mappings: '' },
          }
        },
      },
    ]
  }

  return {
    resolve: {
      alias,
    },
    plugins: [...commonPlugins],
    ...userConfig,
  }
})
