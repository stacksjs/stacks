import { defineBuildConfig } from 'unbuild'
import { alias } from './src'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/development',
  ],

  outDir: './dist/',
  clean: true,
  declaration: true,
})
