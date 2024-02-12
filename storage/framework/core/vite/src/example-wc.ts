import { examplesPath } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import { defineConfig } from 'vite'

export const webComponentsExampleConfig = {
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
