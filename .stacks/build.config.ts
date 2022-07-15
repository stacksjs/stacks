import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/cli',
  ],
  declaration: true,
  clean: true,
  externals: ['vitepress', 'stacks'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
