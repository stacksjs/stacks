import { defineConfig } from 'vite'
import type { UserConfig as ViteConfig } from 'vite'
import { examplesPath } from 'utils'
import { uiEngine } from './'

export const webComponentsExampleConfig: ViteConfig = {
  root: examplesPath('web-components'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    uiEngine(true),
  ],
}

export default defineConfig(() => {
  return webComponentsExampleConfig
})
