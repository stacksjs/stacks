import { defineNitroConfig } from 'nitropack'
// import { deploy } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
// import { resolve } from '@stacksjs/path'

// eslint-disable-next-line no-console
console.log('here', alias)

export default defineNitroConfig({
  // alias,
  preset: 'aws-lambda',
  srcDir: './',
})
