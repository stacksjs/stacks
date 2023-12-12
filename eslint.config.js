import stacks from '@stacksjs/eslint-config'

export default stacks({
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  // TypeScript & Vue are auto-detected
  // you may also explicitly enable them:
  typescript: true,
  vue: true,

  // Enable jsonc, yaml, toml support
  jsonc: true,
  yaml: true,
  toml: true,
})
