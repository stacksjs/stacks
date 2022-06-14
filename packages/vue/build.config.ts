import { defineBuildConfig } from 'unbuild'
import typescript from 'rollup-plugin-typescript2';

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
    '@vueuse/core', 'vue', 'unocss', 'vite', '@vitejs/plugin-vue', 'pathe', 'fs', '@unocss/inspector', 'crypto', 'url'
  ],
})
