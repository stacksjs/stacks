import type { ViteConfig } from '@stacksjs/types'
import { alias } from '@stacksjs/alias'
import { examplesPath } from '@stacksjs/path'

export const webComponentsExampleConfig: ViteConfig = {
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

export default webComponentsExampleConfig
