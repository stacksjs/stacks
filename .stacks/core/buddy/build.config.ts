import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries: [
    './src/cli',
  ],
  declaration: false,
  clean: false,
  externals: ['chokidar', '@intlify/shared', '@intlify/message-compiler', 'vite', 'gray-matter'],
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
})
