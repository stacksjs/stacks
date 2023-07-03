import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    // {
    //   input: './src/utils/config',
    //   format: 'cjs',
    // },
    './src/index',
  ],

  declaration: true,
  clean: false,
})
