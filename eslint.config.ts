import stacks from '@stacksjs/eslint-config'

export default stacks({
  // Enable stylistic formatting rules
  // stylistic: true,

  // Or customize the stylistic rules
  stylistic: {
    indent: 2,
    quotes: 'single', // or 'double'
  },

  typescript: true,
  vue: false,
  jsonc: true,
  yaml: true,
  unocss: true,

  ignores: [
    '**/fixtures',
    // ...globs
  ],
})
