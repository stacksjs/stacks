import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  alias: {
    '@ow3/hello-world-composable': '../composables/src/index.ts',
  },
  entries: [
    'src/index.ts',
  ],
  // clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    '@vueuse/core', 'vue', 'unocss',
  ],
})
