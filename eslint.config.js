import stacks from '@stacksjs/lint'

export default stacks({
  // Enable stylistic formatting rules
  stylistic: true,

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

  // `.eslintignore` is no longer supported in Flat config, use `ignores` instead
  ignores: [
    '**/fixtures',
    '**/cdk.out',
    '**/framework/server',
    "**/.vite-ssg-temp"
    // ...globs
  ],
})
