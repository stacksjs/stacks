import { alias } from '@stacksjs/alias'
import { defineBuildConfig } from 'unbuild'

// eslint-disable-next-line no-console
console.log('Building @stacksjs/core...')

export default defineBuildConfig({
  alias,

  entries: [
    './src/index.ts',
    // {
    //   builder: 'mkdist',
    //   input: './src/',
    //   outDir: './dist/',
    // },
  ],

  declaration: true,

  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
