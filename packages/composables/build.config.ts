import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    '@vueuse/core', 'vue', 'unocss', 'unocss/vite', 'resolve', 'path', '@vitejs/plugin-vue', 'vite'
  ],
})
