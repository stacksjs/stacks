import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
  ],

  declaration: true,
})
