import { defineStxConfig } from '@stacksjs/stx'

export default defineStxConfig({
  enabled: true,
  debug: false,
  cache: true,
  streaming: {
    enabled: true,
  },
  markdown: {
    enabled: true,
    syntaxHighlighting: {
      enabled: true,
      serverSide: true,
      defaultTheme: 'github-dark',
    },
  },
})
