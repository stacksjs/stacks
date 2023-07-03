import { alias, defineBuildConfig } from '@stacksjs/development'

// eslint-disable-next-line no-console
console.log('here')
export default defineBuildConfig({
  alias,

  entries: [
    {
      input: './src/utils/config',
      format: 'cjs',
    },
    // './src/index',
  ],

  declaration: true,
  clean: false,
})
