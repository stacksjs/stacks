import { defineBuildConfig } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

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
