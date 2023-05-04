import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
  ],
  // entries: [
  //   {
  //     builder: 'mkdist',
  //     input: './src/',
  //     outDir: './dist/',
  //   },
  // ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
})
