import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // 'src/index',
    { input: 'src/components/', outDir: 'dist/components' }, // this works but not generating MyComponent.vue.d.ts
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    // inlineDependencies: true,
  },
  externals: ['vite']
})
