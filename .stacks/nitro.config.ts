import { defineNitroConfig } from 'nitropack'
import { projectPath } from './src'

export default defineNitroConfig({
  srcDir: projectPath(),
})
