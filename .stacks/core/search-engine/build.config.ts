import { defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
    },
  ],
  // declaration: true,
  clean: true,
  // rollup: {
  //   inlineDependencies: true,
  // },
  // externals: [
  //   'vue',
  // ],
})
