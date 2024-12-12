import stacks from '@stacksjs/eslint-config'

export default stacks({
  // Enable stylistic formatting rules
  // stylistic: true,

  // Or customize the stylistic rules
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  typescript: true,
  vue: true,
  jsonc: true,
  yaml: true,
  unocss: true,

  ignores: [
    '**/fixtures',
    // ...globs
  ],
})
