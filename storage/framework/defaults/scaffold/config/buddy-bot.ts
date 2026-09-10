import type { BuddyBotConfig } from 'buddy-bot'

/**
 * buddy-bot is the one dependency bot a Stacks app runs.
 *
 * `.github/workflows/buddy-bot.yml` is what drives it: updates every two
 * hours, a dashboard issue 15 minutes later, and a daily pass that closes pull
 * requests whose bump already landed. Nothing else should be opening
 * dependency pull requests here - two bots proposing the same bump is
 * stacksjs/stacks#2574, and it costs a full CI matrix per duplicate.
 */
export default {
  repository: {
    provider: 'github',
    // In Actions this is already the account or organization the repository
    // lives under, which is the only place the workflow above runs. Replace the
    // fallback if you also run buddy-bot locally.
    owner: process.env.GITHUB_REPOSITORY_OWNER || 'your-github-owner',
    name: '__APP_SLUG__',
    // token: process.env.BUDDY_BOT_TOKEN,
  },

  dashboard: {
    enabled: true,
    title: 'Dependency Dashboard',
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
      // Packages to hold back, e.g. '@types/node'
    ],
    ignorePaths: [
      // Glob patterns to skip, e.g. 'apps/legacy/**'
    ],
  },

  verbose: false,
} satisfies BuddyBotConfig
