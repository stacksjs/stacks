import { defineNitroConfig } from 'nitropack'

// import { alias } from '@stacksjs/alias'
// import { resolve } from '@stacksjs/path'
// import { deploy } from '@stacksjs/config'

export default defineNitroConfig({
  // alias,
  output: {
    dir: '.output',
    serverDir: '.output/server',
    publicDir: '.output/public',
  },
  preset: 'aws-lambda',
  // rootDir: resolve(__dirname, '.'),
  // srcDir: resolve(__dirname, '.'),
})
