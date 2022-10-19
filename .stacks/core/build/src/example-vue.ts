import { defineConfig } from 'vite'
import type { ViteConfig } from 'types'
import { examplesPath } from 'utils'
import { uiEngine } from '.'

export const vueComponentsExampleConfig: ViteConfig = {
  root: examplesPath('vue-components'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    uiEngine(),
  ],
}

export default defineConfig(() => {
  return vueComponentsExampleConfig
})
