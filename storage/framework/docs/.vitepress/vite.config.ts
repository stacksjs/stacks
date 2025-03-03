import { resolve } from 'node:path'
// import Inspect from 'vite-plugin-inspect'
import { alias } from '@stacksjs/alias'
import { path } from '@stacksjs/path'
// Removed server import from @stacksjs/server
import UnoCSS from 'unocss/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: path.publicPath(),

  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },

  // Hardcoded server config for "docs" type
  server: {
    host: 'localhost',
    port: 3333, // Assuming this is the docs port - update if different
    open: false,
  },

  resolve: {
    alias,

    dedupe: [
      'vue',
      '@vue/runtime-core',
    ],
  },

  plugins: [
    // custom
    // MarkdownTransform(),
    // Contributors(contributions),

    // plugins
    Components({
      dirs: [path.resourcesPath('components/Docs'), path.frameworkPath('defaults/components/Docs')],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [
        IconsResolver({
          componentPrefix: '',
        }),
      ],
      dts: resolve(__dirname, 'components.d.ts'),
      transformer: 'vue3',
    }),

    Icons({
      compiler: 'vue3',
      defaultStyle: 'display: inline-block',
    }),

    UnoCSS(resolve(__dirname, 'unocss.config.ts')),

    // Inspect(),
  ],

  optimizeDeps: {
    exclude: [
      // 'vue',
      'body-scroll-lock',
    ],

    include: [
      'nprogress',
    ],
  },
})
