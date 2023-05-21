import { defineServerConfig } from '@stacksjs/server'
import { projectPath } from '@stacksjs/path'

export default defineServerConfig({
  preset: 'aws-lambda',
  srcDir: projectPath(),
})
