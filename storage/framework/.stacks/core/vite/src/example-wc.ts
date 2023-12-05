import type { ViteConfig } from 'stacks:types'
import { examplesPath } from 'stacks:path'
import { server } from 'stacks:server'
import { alias } from 'stacks:alias'
import { defineConfig } from './'

// import { uiEngine } from '.'

export const webComponentsExampleConfig: ViteConfig = {
  root: examplesPath('web-components'),

  resolve: {
    alias,
  },

  server: server({
    type: 'example',
  }),

  // plugins: [
  //   uiEngine(true),
  // ],
}

export default defineConfig(() => {
  return webComponentsExampleConfig
})
