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

  clean: true,
  declaration: true,
})
