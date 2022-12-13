import { defineBuildConfig } from 'unbuild'
import { email } from '@stacksjs/config'

export default defineBuildConfig({
  email.style,
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
