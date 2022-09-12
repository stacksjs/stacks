import { resolve } from 'pathe'
import { defineNitroConfig } from 'nitropack'

export default defineNitroConfig({
  srcDir: resolve(__dirname, '..'),
})
