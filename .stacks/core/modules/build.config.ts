import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,

  entries: [
    './src/i18n',
    './src/nprogress',
    './src/pwa',
  ],

  externals: [
    'virtual:pwa-register',
  ],

  clean: false,
  declaration: true,
})
