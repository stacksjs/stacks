import type { ViteConfig } from '@stacksjs/types'
import { examplesPath } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { defineConfig } from './'

// import { uiEngine } from '.'

export const webComponentsExampleConfig: ViteConfig = {
  root: examplesPath('web-components'),

  resolve: {
    alias,
  },

  server,

  // plugins: [
  //   uiEngine(true),
  // ],
}

export default defineConfig(() => {
  return webComponentsExampleConfig
})
