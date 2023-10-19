import stacks from '@stacksjs/eslint-config'

export default stacks({
  ignores: [
    '**/cdk.out/**',
    '**/runtime/server.js',
    // '**/runtime/server.js',
  ],
})
