import { defineConfig } from 'vite'
import type { UserConfig as ViteConfig } from 'vite'
import { examplesPath } from 'framework/utils/src/helpers'
import { uiEngine } from 'stacks'

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
