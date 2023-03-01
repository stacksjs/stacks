import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  failOnWarn: false, // it may fail for "Potential missing package.json files: dist/index.mjs, dist/index.d.ts"
  alias,
  entries: [
    './src/cli',
  ],
  declaration: false,
  clean: false,
  externals: ['chokidar', '@intlify/shared', '@intlify/message-compiler', 'vite', 'gray-matter'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
