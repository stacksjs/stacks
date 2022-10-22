import { defineBuildConfig } from 'unbuild'
import { alias } from './alias'

// console.log('alias', alias)

export default defineBuildConfig({
  alias,
  entries: [
    './src/cli',
  ],
  declaration: false,
  clean: false,
  externals: ['chokidar', '@intlify/shared', '@intlify/message-compiler', 'vite', 'gray-matter'],
  rollup: {
    inlineDependencies: true,
  },
})
