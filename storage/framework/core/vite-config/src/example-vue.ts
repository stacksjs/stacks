import { alias } from '@stacksjs/alias'
import { examplesPath } from '@stacksjs/path'
import type { ViteConfig } from '@stacksjs/types'

export const vueComponentsExampleConfig: ViteConfig = {
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
}

export default vueComponentsExampleConfig
