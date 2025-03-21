import config from '@stacksjs/eslint-config'

export default config({
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
    '**/*.md',
    '**/*.yaml',
    // ...globs
  ],
})
