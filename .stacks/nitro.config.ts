import { resolve } from 'path'
import { defineNitroConfig } from 'nitropack'

export default defineNitroConfig({
  srcDir: resolve(__dirname, '..'),
})
