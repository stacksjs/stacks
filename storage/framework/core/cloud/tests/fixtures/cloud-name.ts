// Prints the stack name and region @stacksjs/cloud resolves, for stack-name.test.ts.
const { stacksCloudName, stacksCloudRegion } = await import('../../src/helpers')
console.log(JSON.stringify({ name: await stacksCloudName(), region: await stacksCloudRegion() }))
process.exit(0)
