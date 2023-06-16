import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  outDir: './dist/',
  clean: true,
  declaration: true,
})
