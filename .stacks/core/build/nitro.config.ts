import { defineNitroConfig } from 'nitropack'
import { projectPath } from '@stacksjs/path'

export default defineNitroConfig({
  srcDir: projectPath(),
})
