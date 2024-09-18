import { requestModelAccess } from '@stacksjs/ai'

if (require.main === module) {
  requestModelAccess().catch(console.error)
}
