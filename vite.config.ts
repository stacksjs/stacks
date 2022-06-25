// import { resolve } from 'path'
import type { UserConfig as ViteConfig } from 'vite'
import { defineConfig } from 'vite'
// import Unocss from 'unocss/vite'
// import { UiEngine } from 'stacks/src/core'
import Vue from '@vitejs/plugin-vue'
import { alias } from './config/alias'
// import Inspect from 'vite-plugin-inspect'
// import AutoImport from 'unplugin-auto-import/vite'
// import Components from 'unplugin-vue-components/vite'
// import { alias } from '../config/alias'

// eslint-disable-next-line no-console
console.log('reaching?')

// https://vitejs.dev/config/
const config: ViteConfig = {
  root: '/Users/chrisbreuer/Code/stacks-framework/playground',

  resolve: {
    alias,
  },

  plugins: [
    Vue({
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom elements
          isCustomElement: tag => tag.includes('hello-world'),
        },
      },
    }),
  ],
}

// console.log('config is here?', config)

export default defineConfig(({ command }) => {
  // eslint-disable-next-line no-console
  console.log('testing?', command)
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
