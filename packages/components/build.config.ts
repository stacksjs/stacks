import { defineBuildConfig } from 'unbuild'
import { alias } from '../../config'

export default defineBuildConfig({
  alias,
  entries: [
    'index.ts',
  ],
  // clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    'vue', '@vueuse/core', 'unocss/vite',
  ],
})
