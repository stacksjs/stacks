import { alias, defineBuildConfig } from '@ow3/stacks'

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
