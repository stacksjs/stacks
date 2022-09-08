import { resolve } from 'node:path'
import { defineNitroConfig } from 'nitropack'

export default defineNitroConfig({
  srcDir: resolve(__dirname, '..'),
})
