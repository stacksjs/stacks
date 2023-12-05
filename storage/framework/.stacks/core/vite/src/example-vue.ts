import type { ViteConfig } from 'stacks:types'
import { examplesPath } from 'stacks:path'
import { server } from 'stacks:server'
import { alias } from 'stacks:alias'
import { defineConfig } from './'

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
