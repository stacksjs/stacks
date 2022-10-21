import { defineBuildConfig } from 'unbuild'
import { alias } from './alias'

// eslint-disable-next-line no-console
console.log('alias', alias)

export default defineBuildConfig({
  alias,
  entries: [
    './src/cli.ts',
  ],
  declaration: true,
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
})
