// import type { ViteConfig } from '../core'
import { defineConfig } from '../core'
// import { defineConfig, Stacks } from '../core'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import alias from '../../../config/alias'
import { resolve } from 'path'
import { UserConfig } from 'vite'

const dirPath = resolve(__dirname, '../../../components/src')
const dtsPath = resolve(__dirname, '../../types/components.d.ts')

const UiEngine = Vue({
  template: {
    compilerOptions: {
      // treat all tags with a dash as custom elements
      isCustomElement: tag => tag.includes('hello-world'),
    },
  },
})

export function styleEngine() {
  return Unocss({
    configFile: resolve(__dirname, '../unocss.ts'),
    mode: 'vue-scoped', // or 'shadow-dom'
  })
}

// https://github.com/antfu/unplugin-auto-import
const autoImports = AutoImport({
  imports: ['vue', '@vueuse/core', 
  // {
    // TODO: this needs to be dynamically generated
    // '@ow3/hello-world-functions': ['count', 'increment', 'isDark', 'toggleDark'],
  // }
],
  dts: resolve(__dirname, '../../types/auto-imports.d.ts'),
  eslintrc: {
    enabled: true,
    filepath: resolve(__dirname, '../../.eslintrc-auto-import.json'),
  },
})

const components = (dirPath: string, dtsPath: string) => Components({
  dirs: [dirPath],
  extensions: ['vue'],
  dts: dtsPath,
})

// https://vitejs.dev/config/
// const config: ViteConfig = {
const config: UserConfig = {
  root: resolve(__dirname, '../../../playgrounds'),

  optimizeDeps: {
    include: ['stacks'],
  },  

  resolve: {
    alias,
  },

  plugins: [
    Inspect(),
  
    UiEngine,

    styleEngine(),

    autoImports,

    components(dirPath, dtsPath),
  ],

  // build: {
  //   rollupOptions: {
  //     output: {
  //       // exports: 'named',
  //       globals: {
  //         vue: 'Vue',
  //       },
  //     },
  //   },
  // }
}

// eslint-disable-next-line no-console
console.log('hello playground')

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // eslint-disable-next-line no-console
    console.log('config', JSON.stringify(config))
    return config
  }

  // command === 'build'
  return config
})
