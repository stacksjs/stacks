import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
  ],
  declaration: true,
  clean: true,
})
