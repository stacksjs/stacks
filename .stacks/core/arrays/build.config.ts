import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries,
  clean: true,
  declaration: true,
})
