import stacks from '@stacksjs/eslint-config'

export default stacks({
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  // Enable jsonc, yaml, toml support
  jsonc: true,
  yaml: false,
  toml: true,
})
