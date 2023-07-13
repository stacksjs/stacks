import { defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,
  declaration: true,
  clean: false,
})
