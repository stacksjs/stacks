import { execSync, parseOptions } from '@stacksjs/cli'
import { dns } from '@stacksjs/config/user'

// Get what options were passed into the CLI
const args = parseOptions()

// Parse command line arguments
const processArgs = process.argv.slice(2)

// Replace these values with your actual access key ID and secret access key
// const accessKeyId = 'YOUR_ACCESS_KEY_ID' // Should get from ENV
// const secretAccessKey = 'YOUR_SECRET_ACCESS_KEY' // Should get from ENV

// // Construct the command to run `aws configure` with the provided access key and secret access key
// const command = `aws configure --aws-access-key-id ${accessKeyId} --aws-secret-access-key ${secretAccessKey}`

// try {
//   // Execute the command synchronously using the child_process module
//   const output = execSync(command)
//   console.log(output.toString())
// }
// catch (error) {
//   console.error(`Error: ${error.stderr.toString()}`)
// }

// for (let i = 0; i < args.length; i += 2) {
//   const option = args[i]
//   const value = JSON.parse(args[i + 1])

//   switch (option) {
//     case '--hosted-zone':
//       options.hostedZone = value
//       break
//     case '--a':
//       options.a.push(value)
//       break
//     case '--aaaa':
//       options.aaaa.push(value)
//       break
//     case '--cname':
//       options.cname.push(value)
//       break
//     case '--mx':
//       options.mx.push(value)
//       break
//     case '--txt':
//       options.txt.push(value)
//       break
//     default:
//       console.error(`Invalid option: ${option}`)
//       process.exit(1)
//   }
// }

// Set the path to the AWS CDK stack folder
const stackFolder = '.stacks/aws'

// Change the current working directory to the stack folder
process.chdir(stackFolder)

// Sample should read from the CLI options / from defined DNS?
const json = JSON.stringify(dns)
const deployCommand = `cdk deploy --parameters dnsconfig='${json}'`

try {
  const output = execSync(deployCommand, { stdio: 'inherit' })
  console.log(`Success: ${output}`)
}
catch (error) {
  console.error(`Error: ${error.message}`)
}
