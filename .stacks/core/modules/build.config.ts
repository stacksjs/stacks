import { alias, defineBuildConfig } from '@stacksjs/development'

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
