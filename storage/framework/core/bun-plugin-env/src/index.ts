import process from 'node:process'
import { plugin } from 'bun'

await plugin({
  name: 'ENV',
  async setup(build) {
    (await import('dotenv')).config()

    // when a .yaml file is imported...
    build.onLoad({ filter: /\.(env)$/ }, async () => {
      const exports = process.env

      // and return it as a module
      return {
        exports: {
          default: exports,
          ...exports,
        },
        loader: 'object', // special loader for JS objects
      }
    })
  },
})
