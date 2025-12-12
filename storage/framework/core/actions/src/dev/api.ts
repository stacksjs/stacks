import { log, parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { serve } from '@stacksjs/router'
import { initiateImports } from '@stacksjs/server'

const options = parseOptions()

log.debug('Starting API dev server...', options)

initiateImports()

await serve({
  port: config.ports?.api, // defaults to 3008
})
