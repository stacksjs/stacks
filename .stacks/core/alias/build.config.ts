import { defineBuildConfig } from 'unbuild'
import { alias } from './src'

export default defineBuildConfig({
  alias,

  entries: [
    {
      input: './src',
      outDir: './dist',
      builder: 'mkdist',
    },
  ],

  externals: [
    '@stacksjs/path',
  ],

  // rollup: {
  //   inlineDependencies: true,
  // },

  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,
})
