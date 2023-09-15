import { createHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { projectStoragePath } from '@stacksjs/path'
import { italic } from '@stacksjs/cli'

console.log('Adding your domain...', app.url)

if (!app.url) {
  handleError('./config app.url is not defined')
  process.exit(1)
}

const result = await createHostedZone(app.url)

if (result.isErr()) {
  handleError('Failed to add domain', app.url)
  process.exit(1)
}

const nameservers = result.value

console.log('')
console.log('✅ Added your domain')
console.log('  Nameservers: ' + nameservers.join(', '))
console.log('  Cached in: ' + projectStoragePath('framework/cache/nameservers.txt'))
console.log('')
console.log(italic('Please update your domain nameservers to the above values.'))
