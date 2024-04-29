import { alias } from '@stacksjs/alias'
import { examplesPath } from '@stacksjs/path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: examplesPath('vue-components'),

  resolve: {
    alias,
  },

  // server: server({
  //   type: 'example',
  // }),

  // plugins: [
  //   uiEngine(),
  // ],
})
