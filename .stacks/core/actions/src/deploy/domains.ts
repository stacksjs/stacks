// import { dns } from '@stacksjs/config/user'
import { AwsStackFunction } from '@stacksjs/cloud'

(async () => {
//   await AwsStack(dns)
  AwsStackFunction()
})()

// Get what options were passed into the CLI
// const args = parseOptions()

// // Parse command line arguments
// const processArgs = process.argv.slice(2)

// // eslint-disable-next-line no-console
// console.log('processArgs', processArgs)
