import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,
  clean: false,
  declaration: true,
})
