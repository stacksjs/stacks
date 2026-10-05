// Prints the stack name @stacksjs/cloud resolves, for stack-name.test.ts.
const { stacksCloudName } = await import('../../src/helpers')
console.log(JSON.stringify({ name: await stacksCloudName() }))
process.exit(0)
