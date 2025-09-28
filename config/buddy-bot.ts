import type { BuddyBotConfig } from 'buddy-bot'

export default {
  repository: {
    owner: 'stacksjs',
    name: 'stacks',
    provider: 'github',
    // token: process.env.BUDDY_BOT_TOKEN,
  },
  dashboard: {
    enabled: true,
    title: 'Dependency Dashboard',
    // issueNumber: undefined, // Auto-generated
  },
  workflows: {
    enabled: true,
    outputDir: '.github/workflows',
    templates: {
      daily: true,
      weekly: true,
      monthly: true,
    },
    custom: [],
  },
  packages: {
    strategy: 'all',
    ignore: [
      // Add packages to ignore here
      // Example: '@types/node', 'eslint'
    ],
    ignorePaths: [
      // Add file/directory paths to ignore using glob patterns
      // Example: 'packages/test-*/**', '**/*test-envs/**', 'apps/legacy/**'
    ],
  },
  verbose: false,
} satisfies BuddyBotConfig
