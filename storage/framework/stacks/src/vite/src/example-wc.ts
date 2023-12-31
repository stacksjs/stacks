import type { ViteConfig } from 'src/types/src'
import { examplesPath } from 'src/path/src'
import { server } from 'src/server/src'
import { alias } from 'src/alias/src'
import { defineConfig } from '.'

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
