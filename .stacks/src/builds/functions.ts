import { resolve } from 'path'
import type { BuildConfig } from 'unbuild'
import { defineBuildConfig } from 'unbuild'
import alias from '../../../config/alias'

// import { defineBuildConfig } from 'unbuild'

const config: BuildConfig = {
  alias,
  entries: [resolve(__dirname, '../../src/functions.ts')],
  outDir: resolve(__dirname, '../../composables/dist'),
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  externals: [
    'vue', '@vueuse/core',
  ],
}

export default defineBuildConfig(config)
