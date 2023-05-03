import { defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
    },
  ],

  declaration: true,

  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
