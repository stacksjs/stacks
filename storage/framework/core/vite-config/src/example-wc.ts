import { examplesPath } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import { defineConfig } from 'vite'

export const webComponentsExampleConfig = {
  root: examplesPath('web-components'),

  resolve: {
    alias,
  },

  // server: server({
  //   type: 'example',
  // }),

  // plugins: [
  //   uiEngine(true),
  // ],
}

export default defineConfig(() => {
  return webComponentsExampleConfig
})
