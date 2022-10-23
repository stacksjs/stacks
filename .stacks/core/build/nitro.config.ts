import { defineNitroConfig } from 'nitropack'
import { projectPath } from '@stacksjs/paths'

export default defineNitroConfig({
  srcDir: projectPath(),
})
