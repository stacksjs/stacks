import process from 'node:process'
import { serve } from '@stacksjs/router'

process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('Exited using Ctrl-C')
  process.exit()
})

serve({
  port: 3999,
})

// eslint-disable-next-line no-console
console.log(`Listening on http://localhost:3999 ...`)
