import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
  ],

  externals: [
    'vite',
    'vitepress',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: true,
  declaration: true,
})
