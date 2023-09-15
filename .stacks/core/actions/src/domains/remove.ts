import { handleError } from '@stacksjs/error-handling'
import { deleteHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'

console.log(`Removing domain: ${app.url}`)

if (!app.url) {
  handleError('./config app.url is not defined')
  process.exit(1)
}

const result = await deleteHostedZone(app.url)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}

console.log('')
console.log('✅ Removed your domain')
