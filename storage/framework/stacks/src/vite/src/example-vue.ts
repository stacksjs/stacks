import type { ViteConfig } from 'src/types/src'
import { examplesPath } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { defineConfig } from '.'

// import { uiEngine } from '.'

export const vueComponentsExampleConfig: ViteConfig = {
  root: examplesPath('vue-components'),

  resolve: {
    alias,
  },

  server: server({
    type: 'example',
  }),

  // plugins: [
  //   uiEngine(),
  // ],
}

export default defineConfig(() => {
  return vueComponentsExampleConfig
})
