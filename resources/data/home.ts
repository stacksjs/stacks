/**
 * What the home page says beyond the feature list: who already runs on
 * Stacks, and the questions a first visit ends with.
 *
 * Both are here rather than typed into index.stx for the same reason the
 * features are in features.ts. The questions are rendered twice, as the
 * section a person reads and as the FAQPage block a crawler or an answer
 * engine reads, and two copies of an answer disagree by the second edit.
 * tests/unit/marketing-home.test.ts holds both to what they claim.
 */

export interface ShowcaseProduct {
  name: string
  /** What the product is, in its own words rather than ours. */
  what: string
  icon: string
  /** The live product. Every one of these has to answer. */
  url: string
  /** Shown as the link, without the scheme. */
  host: string
}

/**
 * Products in production on Stacks. Each line is the product's own
 * description of itself, checked against its site in November 2026, and the
 * list is the one the Laravel comparison and the startup use case already
 * name. Add to it only what is live and built on Stacks: this section is the
 * page's only proof that somebody ships with it.
 */
export const showcase: ShowcaseProduct[] = [
  { name: 'BugHQ', what: 'Error tracking that captures, groups, and triages production errors.', icon: 'i-hugeicons-bug-01', url: 'https://bughq.org', host: 'bughq.org' },
  { name: 'StatusHQ', what: 'Uptime, SSL, and DNS monitoring with public status pages.', icon: 'i-hugeicons-activity-01', url: 'https://statushq.org', host: 'statushq.org' },
  { name: 'AnalyticsHQ', what: 'Cookieless web analytics with real-time visitors and sources.', icon: 'i-hugeicons-analytics-01', url: 'https://analyticshq.org', host: 'analyticshq.org' },
  { name: 'LogHQ', what: 'Application logs you stream, search, and filter in a live UI.', icon: 'i-hugeicons-file-search', url: 'https://loghq.org', host: 'loghq.org' },
  { name: 'CommsHQ', what: 'Email, SMS, publishing, and automation in one workspace.', icon: 'i-hugeicons-megaphone-01', url: 'https://commshq.org', host: 'commshq.org' },
]

export interface Faq {
  question: string
  /**
   * Plain text, and complete on its own: an answer engine quotes one answer
   * without the section around it, so each one names Stacks and says the
   * thing rather than pointing at another answer.
   */
  answer: string
  /** Where the longer version lives, when the site has one. */
  link?: { label: string, url: string, native?: boolean }
}

/**
 * The objections a framework page has to meet before anyone installs
 * anything: what it is, whether it is safe to bet on, what it needs, what it
 * costs to leave parts out, and where it runs. Every claim below is one the
 * rest of the site already makes and a test or a feature page already backs.
 */
export const faqs: Faq[] = [
  {
    question: 'What is Stacks?',
    answer: 'Stacks is the all-in-one TypeScript framework, running on Bun. One install gives you routing, an ORM whose migrations are generated from your models, auth, queues, mail, a CMS, commerce, AI drivers, an admin dashboard, tests, and deploys to servers you own. It is open source under the MIT license.',
    link: { label: 'See every feature', url: '/features' },
  },
  {
    question: 'Is Stacks ready for production?',
    answer: 'It runs in production today: BugHQ, StatusHQ, AnalyticsHQ, LogHQ, and CommsHQ are Stacks applications, and so is this site. Stacks is still before version 1.0, so an API can change between releases. buddy upgrade exists for that: it previews the changes, then moves the app to the next release without touching your uncommitted edits.',
    link: { label: 'How upgrades work', url: '/features/automated-upgrades' },
  },
  {
    question: 'What does it need to run?',
    answer: 'Stacks needs Bun, and a database: SQLite, MySQL, or Postgres. You do not install either by hand. Pantry reads the tools a project declares and installs them per project, then starts the database and migrates it, so a new machine is one command away from a running app.',
    link: { label: 'Environment setup', url: '/features/environment-setup' },
  },
  {
    question: 'Do I have to use all of it?',
    answer: 'No. Every config file is optional, and whole bundles such as commerce or the CMS install and uninstall with one command, so what you do not use is not loaded. A Stacks app can be a single API, a marketing site, or a library, and grow into the rest later.',
    link: { label: 'What people build with it', url: '/use-cases' },
  },
  {
    question: 'Where can I deploy a Stacks app?',
    answer: 'A Stacks app deploys anywhere you can reach over SSH: Hetzner, AWS, another Linux server, or a Raspberry Pi. buddy deploy builds the site, docs, blog, and API, then sets up DNS, TLS, storage, and mail from config/cloud.ts. There is no hosting platform to subscribe to, and a bad release rolls back with one command.',
    link: { label: 'Cloud deploys', url: '/features/cloud-deploys' },
  },
  {
    question: 'I know Laravel. How different is Stacks?',
    answer: 'Not very, on purpose. Models, migrations, queues, mail, events, gates, and an expressive CLI are Laravel ideas, and Stacks keeps their shape. What changes is the language: the model, the route, the view, and the API client are all TypeScript, typed against each other from the database row to the rendered page.',
    link: { label: 'Stacks vs Laravel', url: '/compare/laravel' },
  },
  {
    question: 'How does Stacks work with AI coding agents?',
    answer: 'A Stacks app checks in one AGENTS.md, and buddy setup:ai turns it into the files Claude Code, Codex, Cursor, Copilot, and Gemini each read. It also ships a skill for every subsystem, so an agent works from the real API of the framework rather than guessing one, and buddy lint, typecheck, and test gate its changes the same way they gate yours.',
    link: { label: 'Read AGENTS.md', url: 'https://github.com/stacksjs/stacks/blob/main/AGENTS.md', native: true },
  },
]
