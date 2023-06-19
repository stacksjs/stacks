import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/drivers/openai',
    './src/index',
  ],

  clean: true,
  declaration: true,
})
