import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

// eslint-disable-next-line no-console
console.log('here')

export default defineBuildConfig({
  alias,
  entries: [
    // 'src/index',
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
    },
  ],
  declaration: true,
  clean: true,
})
