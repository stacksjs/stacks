import { resolve } from 'pathe'
import { defineNitroConfig } from 'nitropack'
import { _dirname } from './core'

export default defineNitroConfig({
  srcDir: resolve(_dirname, '..'),
})
