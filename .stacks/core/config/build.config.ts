import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'

// eslint-disable-next-line no-console
console.log('here')

export default defineBuildConfig({
  alias,
  entries: [
    p.configPath('src/index'),
    {
      builder: 'mkdist',
      input: p.configPath('src/user'),
      outDir: p.configPath('dist/user'),
    },
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
})
