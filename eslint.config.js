import stacks from '@stacksjs/eslint-config'

export default stacks({
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: 'single', // or 'double'
  },

  // TypeScript and Vue are auto-detected, you can also explicitly enable them:
  typescript: true,
  vue: true,

  // Enable jsonc and yaml support
  jsonc: true,
  yaml: true,
})
