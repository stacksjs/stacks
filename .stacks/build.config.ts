import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/cli',
  ],
  clean: true,
  rollup: {
    inlineDependencies: true,
  },
})
