import { requestModelAccess } from '@stacksjs/ai'

async function main() {
  try {
    await requestModelAccess()
  }
  catch (error) {
    console.error('Error requesting model access:', error)
  }
}

if (require.main === module) {
  main()
}
