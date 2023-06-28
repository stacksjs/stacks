import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/development',
  ],

  rollup: {
    emitCJS: true,
  },

  outDir: './dist/',
  clean: true,
  declaration: true,
})
