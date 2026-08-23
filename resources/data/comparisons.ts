/**
 * How Stacks compares to the frameworks people actually weigh it against.
 *
 * Same arrangement as features.ts and use-cases.ts: one list, read by the
 * Compare mega menu, the /compare overview, and the /compare/:slug pages.
 *
 * Two rules for the copy in here, because a comparison page that breaks them
 * is worth less than no comparison page at all:
 *
 *   1. Every entry states where the other framework is the better choice, in
 *      its own section, before it states where Stacks is. `verdict.pickThem`
 *      is not optional and is not a hedge.
 *   2. Claims are about what ships in the box, which is checkable, rather
 *      than about speed or quality, which is not.
 *
 * `matrix` is the shape of the table on /compare: for each capability, is it
 * in the box (`built-in`), there but needing assembly or a paid or community
 * add-on (`partial`), or yours to choose and wire (`byo`). It describes the
 * default path a team takes, not the theoretical ceiling: almost anything can
 * be added to almost anything given enough time.
 */

export type MatrixLevel = 'built-in' | 'partial' | 'byo' | 'hosted'

export interface ComparisonMatrix {
  auth: MatrixLevel
  orm: MatrixLevel
  jobs: MatrixLevel
  mail: MatrixLevel
  admin: MatrixLevel
  realtime: MatrixLevel
  deploy: MatrixLevel
}

export interface ComparisonPoint {
  title: string
  text: string
}

export interface ComparisonRow {
  dimension: string
  stacks: string
  other: string
}

export interface Comparison {
  slug: string
  /** The other framework, spelled the way its own docs spell it. */
  name: string
  /** One line for the menu and the overview card. */
  blurb: string
  /** Short category label, shown under the name. */
  kind: string
  language: string
  icon: string
  group: 'fullstack' | 'backends' | 'ecosystems'
  matrix: ComparisonMatrix
  page: {
    headline: string
    lede: string
    /** A fair description of the other framework, in its own terms. */
    summary: string
    /** Where the other one is the better answer. Never empty. */
    theirStrengths: ComparisonPoint[]
    ourStrengths: ComparisonPoint[]
    rows: ComparisonRow[]
    migration: ComparisonPoint[]
    verdict: { pickThem: string, pickStacks: string }
    /** Slugs of other comparisons. */
    related: string[]
  }
}

export const comparisonGroups = [
  { id: 'fullstack', title: 'Full-stack JS', text: 'Frameworks that render pages and own a routing layer.' },
  { id: 'backends', title: 'TypeScript backends', text: 'Server frameworks you would build an API or a service on.' },
  { id: 'ecosystems', title: 'Other ecosystems', text: 'The mature stacks outside TypeScript, and the hosted platforms.' },
] as const

/** The capability rows of the /compare table, in order. */
export const matrixDimensions = [
  { id: 'auth', title: 'Auth and roles' },
  { id: 'orm', title: 'ORM and migrations' },
  { id: 'jobs', title: 'Queues and jobs' },
  { id: 'mail', title: 'Transactional mail' },
  { id: 'admin', title: 'Admin dashboard' },
  { id: 'realtime', title: 'Realtime' },
  { id: 'deploy', title: 'Deploy and infrastructure' },
] as const

/** What each level means, spelled out under the table rather than in a legend nobody reads. */
export const matrixLegend = [
  { level: 'built-in', label: 'In the box', text: 'Ships with the framework and is documented as the way to do it.' },
  { level: 'partial', label: 'Partly', text: 'Available, but through an official add-on, a paid product, or a well-known community package.' },
  { level: 'byo', label: 'Bring your own', text: 'Not provided by the framework. You choose a library and wire it up.' },
  { level: 'hosted', label: 'Hosted service', text: 'Provided, but as a managed service you consume rather than code you run.' },
] as const

/** Stacks own row, shown first in the table. */
export const stacksMatrix: ComparisonMatrix = {
  auth: 'built-in',
  orm: 'built-in',
  jobs: 'built-in',
  mail: 'built-in',
  admin: 'built-in',
  realtime: 'built-in',
  deploy: 'built-in',
}

export const comparisons: Comparison[] = [
  {
    slug: 'nextjs',
    name: 'Next.js',
    blurb: 'The React meta-framework. Stacks answers the backend questions Next.js deliberately leaves open.',
    kind: 'React meta-framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-layers-01',
    group: 'fullstack',
    matrix: { auth: 'byo', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'partial' },
    page: {
      headline: 'Next.js decides how your pages render. Stacks decides the rest too.',
      lede: 'Next.js is a rendering framework with route handlers attached. Everything behind the request, the database layer, the auth, the queue, the mail, the admin, is a decision you make and maintain. Stacks makes those decisions and ships them typed against each other.',
      summary: 'Next.js is the default way to build a React application in 2026. App Router, server components, streaming, and the image and font pipelines are excellent, the ecosystem is the largest in the space, and Vercel makes deploying a React app close to effortless. It is a front end framework that grew server capabilities, and it is honest about stopping where your data layer starts.',
      theirStrengths: [
        { title: 'The React ecosystem', text: 'Every component library, every hiring pool, every Stack Overflow answer. If your interface is React and your team is React, that gravity is real and it is worth something.' },
        { title: 'Server components and streaming', text: 'The RSC model is genuinely ahead on partial rendering and client bundle size, and Stacks does not have an equivalent.' },
        { title: 'Vercel', text: 'Preview deploys per pull request, edge rendering, and analytics with no infrastructure work at all. Stacks deploys to your own AWS account, which is more control and more responsibility.' },
        { title: 'Asset pipelines', text: 'next/image and next/font solve real problems well, and a Stacks project handles images and fonts more manually.' },
      ],
      ourStrengths: [
        { title: 'The backend is not an exercise', text: 'Models, migrations, auth, roles, queues, mail, storage, search, realtime, and an admin dashboard are in the install, not in a list of packages to evaluate.' },
        { title: 'One type graph', text: 'A model attribute, the action that writes it, the route that exposes it, and the view that renders it are typed against each other, so a rename is a compile error rather than a runtime surprise.' },
        { title: 'Infrastructure in the repository', text: 'config/cloud.ts describes DNS, certificates, CDN, and mail records, and buddy deploy applies them. Nothing about production is configured in a console.' },
        { title: 'No build config to own', text: 'STX compiles single-file components on the server without a bundler configuration surface, and buddy dev runs every surface at once.' },
      ],
      rows: [
        { dimension: 'Rendering model', stacks: 'Server-rendered STX components with signals for interactivity', other: 'React server and client components, streaming, partial prerendering' },
        { dimension: 'Data layer', stacks: 'First-party ORM, models drive migrations', other: 'Choose Prisma, Drizzle, Kysely, or raw SQL' },
        { dimension: 'Auth', stacks: 'Sessions, tokens, passkeys, 2FA, RBAC, gates included', other: 'Auth.js, Clerk, or a service' },
        { dimension: 'Background work', stacks: 'Queues, jobs, batches, schedules, workers included', other: 'Inngest, Trigger.dev, QStash, or your own worker' },
        { dimension: 'Admin surface', stacks: 'Dashboard generated from your models', other: 'Build it, or buy Retool or similar' },
        { dimension: 'Runtime', stacks: 'Bun', other: 'Node.js, with edge and Bun support varying by feature' },
        { dimension: 'Hosting', stacks: 'Your AWS account, server or serverless, from config', other: 'Vercel first, self-hosting possible and less travelled' },
        { dimension: 'Language surface', stacks: 'TypeScript everywhere, including infrastructure', other: 'TypeScript, plus whatever your backend services use' },
      ],
      migration: [
        { title: 'Keep Next.js on the front, put Stacks behind it', text: 'A Stacks API with generated OpenAPI and a typed client is a normal thing for a Next.js app to consume. This is the lowest-risk way to try it.' },
        { title: 'Views are the real port', text: 'Route handlers and data access map over cleanly. JSX components do not: STX is its own template language, and a page is a rewrite rather than a copy.' },
        { title: 'Start with the workloads', text: 'Moving queues, mail, and cron out of a Next.js app into Stacks is usually the first thing that pays for itself.' },
      ],
      verdict: {
        pickThem: 'Your interface is React, your team knows it, and you want the largest ecosystem and the easiest hosting story in the industry. Next.js plus a few services is a completely reasonable stack and it is the safe choice.',
        pickStacks: 'You are tired of assembling and maintaining the backend half yourself, and you would rather have one typed application with the queue, the mail, the admin, and the deploy already in it.',
      },
      related: ['t3-stack', 'remix', 'nuxt'],
    },
  },

  {
    slug: 'nuxt',
    name: 'Nuxt',
    blurb: 'Vue meta-framework with a strong module ecosystem. Stacks brings the application layer under it.',
    kind: 'Vue meta-framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-layers-02',
    group: 'fullstack',
    matrix: { auth: 'partial', orm: 'byo', jobs: 'byo', mail: 'partial', admin: 'byo', realtime: 'partial', deploy: 'partial' },
    page: {
      headline: 'Nuxt has the best module ecosystem in the space. Stacks has the application in the box.',
      lede: 'Nuxt covers more of the stack than most meta-frameworks: Nitro gives it a real server, and there is a module for nearly everything. The difference is that a Nuxt application is assembled out of modules you selected, and a Stacks application is one thing that already fits together.',
      summary: 'Nuxt is the Vue answer to the meta-framework question, and it is a good one. File-based routing, auto-imports, layers, and a huge module registry cover auth, content, images, SEO, and testing. Nitro deploys the same application to Node, Deno, Bun, Cloudflare, and Lambda from one build, which is a genuinely useful property that Stacks does not match.',
      theirStrengths: [
        { title: 'Deployment portability', text: 'Nitro presets target a dozen platforms from the same codebase. Stacks targets your own AWS account, server or serverless, and that is the path it is good at.' },
        { title: 'The module registry', text: 'Hundreds of maintained modules, and layers let a team share configuration across projects. Nothing in Stacks matches that breadth of community add-ons.' },
        { title: 'Vue', text: 'If your team writes Vue, single-file components, the composition API, and the devtools are a real productivity story, and STX is not Vue.' },
        { title: 'Content and SEO tooling', text: 'Nuxt Content and the SEO modules are mature and well travelled for documentation and marketing sites.' },
      ],
      ourStrengths: [
        { title: 'One decision instead of twenty', text: 'Auth, ORM, jobs, mail, storage, and admin arrive together and are maintained together, rather than as modules that version independently.' },
        { title: 'A real data layer', text: 'defineModel() drives schema, validation, factories, relationships, and generated migrations. Nuxt leaves the database entirely to you.' },
        { title: 'Background work and mail', text: 'Queues, batches, schedules, and transactional mail are framework features, not a service you add.' },
        { title: 'Infrastructure as reviewed code', text: 'DNS, TLS, CDN, and mail records live in config/cloud.ts and ship with buddy deploy.' },
      ],
      rows: [
        { dimension: 'View layer', stacks: 'STX single-file components with signals', other: 'Vue single-file components' },
        { dimension: 'Server', stacks: 'Bun server, routes, actions, middleware', other: 'Nitro server routes' },
        { dimension: 'Data layer', stacks: 'First-party ORM and model-driven migrations', other: 'Choose Prisma, Drizzle, or an ORM module' },
        { dimension: 'Auth', stacks: 'Included, with RBAC, passkeys and 2FA', other: 'nuxt-auth-utils, Sidebase, or a service' },
        { dimension: 'Background work', stacks: 'Queues, jobs, schedules, workers included', other: 'Scheduled tasks in Nitro, otherwise your own' },
        { dimension: 'Admin surface', stacks: 'Generated from your models', other: 'Build it yourself' },
        { dimension: 'Deploy targets', stacks: 'AWS server or serverless from config', other: 'Many platforms through Nitro presets' },
        { dimension: 'Auto-imports', stacks: 'Models and jobs on the server, composables in views', other: 'Components, composables, and utilities' },
      ],
      migration: [
        { title: 'Nuxt on the front, Stacks behind', text: 'Point a Nuxt app at a Stacks API and its generated client. Nothing about the front end has to change.' },
        { title: 'Composables translate, components do not', text: 'The reactive vocabulary is familiar, since STX signals and composables cover much of the same ground, but templates are a rewrite.' },
        { title: 'Move the server routes first', text: 'Nitro route handlers with real database work are the pieces that gain the most from moving into actions and models.' },
      ],
      verdict: {
        pickThem: 'You are a Vue team, or you need one codebase that deploys to many different platforms. Nuxt is the most complete meta-framework in JavaScript and its module ecosystem is a genuine advantage.',
        pickStacks: 'The parts you keep adding modules for, auth, database, jobs, mail, admin, are the parts you would rather have as one maintained thing.',
      },
      related: ['nextjs', 'sveltekit', 'adonisjs'],
    },
  },

  {
    slug: 'sveltekit',
    name: 'SvelteKit',
    blurb: 'Small bundles and a lovely reactivity model. Stacks adds everything behind the load function.',
    kind: 'Svelte meta-framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-flash',
    group: 'fullstack',
    matrix: { auth: 'byo', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'partial' },
    page: {
      headline: 'SvelteKit ships the least JavaScript. Stacks ships the most application.',
      lede: 'SvelteKit is the most elegant front end story in this comparison and the most deliberately minimal backend one. Load functions, form actions, and adapters are the whole server surface; the database, the auth, the queue, and the admin are yours to select.',
      summary: 'Svelte compiles components away, so the runtime a browser downloads is small, and runes made the reactivity model clearer still. SvelteKit adds file routing, load functions, form actions with progressive enhancement, and adapters for many hosts. Teams that value bundle size and template ergonomics rate it highest of the meta-frameworks, and that judgement is well founded.',
      theirStrengths: [
        { title: 'Bundle size and runtime cost', text: 'Compiled components with no virtual DOM is a real advantage on constrained devices, and STX makes different tradeoffs.' },
        { title: 'Progressive enhancement', text: 'Form actions that work without JavaScript are a first-class idea in SvelteKit rather than an afterthought.' },
        { title: 'Ergonomics', text: 'Runes and the template syntax are widely considered the nicest to write in this category, and that matters daily.' },
        { title: 'Adapters', text: 'Deploy to Cloudflare, Vercel, Netlify, Node, or Bun by changing one adapter.' },
      ],
      ourStrengths: [
        { title: 'The half SvelteKit leaves out', text: 'Models, migrations, auth, roles, queues, mail, storage, search, and an admin dashboard are already there and already typed together.' },
        { title: 'Server-first rendering with signals', text: 'STX renders on the server and hydrates with signals, which covers most application interfaces without a client framework in the bundle.' },
        { title: 'Operations included', text: 'Failed jobs, captured mail, deployment status, and logs are dashboard pages rather than terminal sessions.' },
        { title: 'One deploy command', text: 'buddy deploy builds every surface and publishes the infrastructure that serves it.' },
      ],
      rows: [
        { dimension: 'View layer', stacks: 'STX components, server-rendered, signal hydration', other: 'Svelte components, compiled, client hydration' },
        { dimension: 'Server surface', stacks: 'Routes, actions, middleware, jobs, events', other: 'Load functions, form actions, hooks' },
        { dimension: 'Data layer', stacks: 'First-party ORM and generated migrations', other: 'Choose your own' },
        { dimension: 'Auth', stacks: 'Included', other: 'Lucia-style libraries or a service' },
        { dimension: 'Background work', stacks: 'Included', other: 'Bring your own worker' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Build it yourself' },
        { dimension: 'Hosting', stacks: 'Your AWS account from config', other: 'Adapter per platform' },
        { dimension: 'Bundle weight', stacks: 'Small, but not compiled away', other: 'Smallest of the meta-frameworks' },
      ],
      migration: [
        { title: 'Keep the front end', text: 'A SvelteKit app in front of a Stacks API loses nothing and gains a typed backend immediately.' },
        { title: 'Load functions become actions', text: 'The data-fetch-per-route shape maps closely onto Stacks actions.' },
        { title: 'Expect to rewrite templates', text: 'Svelte components do not port to STX. Plan a page at a time rather than a big-bang rewrite.' },
      ],
      verdict: {
        pickThem: 'The interface is the product, bundle size matters, and you are happy owning the backend decisions. SvelteKit is excellent at exactly what it set out to do.',
        pickStacks: 'The backend decisions are the ones eating your time, and you want them made, maintained, and typed against your views.',
      },
      related: ['nextjs', 'nuxt', 'astro'],
    },
  },

  {
    slug: 'remix',
    name: 'Remix',
    blurb: 'Web fundamentals and nested routing. Stacks agrees with the philosophy and ships more of the stack.',
    kind: 'React meta-framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-structure-03',
    group: 'fullstack',
    matrix: { auth: 'byo', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'partial' },
    page: {
      headline: 'Remix bet on the platform. Stacks makes the same bet and keeps going past the request.',
      lede: 'Loaders, actions, forms, and nested routes are a genuinely good model, and Stacks shares most of the philosophy: server first, HTML first, no state library needed to show a list of rows. The difference is what happens after the response, where Remix stops and Stacks has a queue, a mailer, a scheduler, and an admin.',
      summary: 'Remix, now merged into React Router 7, is built around web standards: Request and Response, forms that post, nested routes that own their data and their errors. It runs anywhere a fetch handler runs, and the mental model is smaller than most of its peers. Teams that adopted it rarely wanted to go back to client-side data fetching, and that is a strong signal.',
      theirStrengths: [
        { title: 'Nested routing and error boundaries', text: 'Data, pending state, and errors scoped per route segment is a better model than most frameworks offer, and Stacks does not have a direct equivalent.' },
        { title: 'Standards all the way down', text: 'Request, Response, FormData, and fetch means less framework-specific knowledge to carry between jobs.' },
        { title: 'React and its ecosystem', text: 'The component libraries, the tooling, and the hiring pool.' },
        { title: 'Runs almost anywhere', text: 'Any platform with a fetch handler will host it, including workers and edge runtimes.' },
      ],
      ourStrengths: [
        { title: 'A data layer, not a loader', text: 'Remix tells you where to fetch data. Stacks gives you the models, the migrations, the validation, and the factories that produce it.' },
        { title: 'Work after the response', text: 'Queues, schedules, events, mail, and notifications are first-party, so the slow half of the application has somewhere to live.' },
        { title: 'Auth and roles included', text: 'Sessions, tokens, passkeys, two-factor, RBAC, and policies rather than a per-project auth assembly.' },
        { title: 'Deploy from config', text: 'The infrastructure that runs it is described in the repository and applied by one command.' },
      ],
      rows: [
        { dimension: 'Routing', stacks: 'File and code routes, groups, model binding', other: 'Nested file routes with per-segment data' },
        { dimension: 'Mutations', stacks: 'Actions with model-declared validation', other: 'Route actions with FormData' },
        { dimension: 'Data layer', stacks: 'First-party ORM', other: 'Choose your own' },
        { dimension: 'Auth', stacks: 'Included', other: 'remix-auth or a service' },
        { dimension: 'Background work', stacks: 'Included', other: 'Bring your own' },
        { dimension: 'Views', stacks: 'STX, server-rendered', other: 'React, server-rendered and hydrated' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Build it yourself' },
        { dimension: 'Deploy', stacks: 'buddy deploy to your AWS account', other: 'Any fetch-handler host' },
      ],
      migration: [
        { title: 'The shapes line up', text: 'Loaders become read actions, route actions become write actions, and the validation moves onto the model.' },
        { title: 'Sessions and auth transfer conceptually', text: 'Cookie sessions and redirect-on-unauthenticated work the same way; the implementation is provided rather than assembled.' },
        { title: 'Components are the cost', text: 'React components are the part that does not port. Consider keeping Remix on the front while the backend moves.' },
      ],
      verdict: {
        pickThem: 'You want React with a standards-based server model, and nested routing with per-segment data and errors is worth building the rest around.',
        pickStacks: 'You like that philosophy but want the database, the queue, the mail, and the admin to come with it.',
      },
      related: ['nextjs', 'sveltekit', 't3-stack'],
    },
  },

  {
    slug: 'astro',
    name: 'Astro',
    blurb: 'The best content site framework there is. Stacks is for when the site becomes an application.',
    kind: 'Content-first framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-note-edit',
    group: 'fullstack',
    matrix: { auth: 'byo', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'partial' },
    page: {
      headline: 'Astro is right about content sites. Stacks is for the day it stops being one.',
      lede: 'For a marketing site, a blog, or documentation, Astro is hard to beat: almost no client JavaScript, content collections with type-checked frontmatter, and islands only where you need interactivity. Stacks is not trying to win that comparison. It is the answer when the site grows accounts, a dashboard, and a queue.',
      summary: 'Astro ships zero JavaScript by default, lets you drop React, Vue, or Svelte components in as islands, and has the most pleasant content pipeline in the ecosystem. Content collections, image optimisation, and the integrations catalogue make a docs or marketing site fast to build and fast to load. Server output and actions have extended it toward applications, but content remains its centre of gravity.',
      theirStrengths: [
        { title: 'Content sites, decisively', text: 'Content collections, MDX, and the image pipeline are better than what Stacks offers for a pure content site, and the output is lighter.' },
        { title: 'Bring any component library', text: 'React, Vue, Svelte, and Solid islands in one project is a genuinely useful escape hatch.' },
        { title: 'Static output', text: 'A fully static build deployed to any CDN has an operational simplicity nothing here beats.' },
        { title: 'Integrations catalogue', text: 'Sitemaps, RSS, analytics, and search are usually one integration away.' },
      ],
      ourStrengths: [
        { title: 'It is an application framework', text: 'Accounts, roles, billing, background work, and an admin dashboard are the things Astro is not trying to be.' },
        { title: 'A CMS you own', text: 'Posts, authors, categories, and comments are models with an editing surface, rather than markdown a developer commits.' },
        { title: 'Dynamic and static together', text: 'Marketing pages, a docs site, a blog, and an authenticated product live in one project and one deploy.' },
        { title: 'Infrastructure and mail', text: 'DNS, certificates, CDN, and transactional mail come from the same config the app reads.' },
      ],
      rows: [
        { dimension: 'Primary use', stacks: 'Applications that also have content', other: 'Content sites that sometimes have an island' },
        { dimension: 'Default output', stacks: 'Server-rendered pages', other: 'Static HTML with optional server output' },
        { dimension: 'Content authoring', stacks: 'CMS models plus markdown', other: 'Content collections in the repository' },
        { dimension: 'Client JavaScript', stacks: 'Signals where needed', other: 'None unless you add an island' },
        { dimension: 'Data layer', stacks: 'First-party ORM', other: 'Choose your own' },
        { dimension: 'Auth', stacks: 'Included', other: 'Bring your own or a service' },
        { dimension: 'Background work', stacks: 'Included', other: 'Not applicable' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'A git-based or hosted CMS' },
      ],
      migration: [
        { title: 'Content moves cleanly', text: 'Markdown in content/ works much the same way, and frontmatter maps onto model attributes when you want an editing surface.' },
        { title: 'Astro pages become STX views', text: 'The template shapes are similar enough that pages port faster than React or Vue components do.' },
        { title: 'Consider keeping both', text: 'An Astro marketing site in front of a Stacks application is a sensible arrangement, and the shared palette is the only coupling.' },
      ],
      verdict: {
        pickThem: 'The project is content, its success is measured in page speed and publishing convenience, and it will not grow accounts or background work.',
        pickStacks: 'There is a product behind the marketing site, or there will be, and you would rather not run two stacks to serve one brand.',
      },
      related: ['nextjs', 'redwoodjs', 'sveltekit'],
    },
  },

  {
    slug: 'redwoodjs',
    name: 'RedwoodJS',
    blurb: 'The closest thing to a full-stack JavaScript framework before this one. Different bets, same goal.',
    kind: 'Full-stack React',
    language: 'TypeScript',
    icon: 'i-hugeicons-structure-01',
    group: 'fullstack',
    matrix: { auth: 'built-in', orm: 'built-in', jobs: 'built-in', mail: 'partial', admin: 'partial', realtime: 'partial', deploy: 'partial' },
    page: {
      headline: 'Same ambition, different bets.',
      lede: 'Redwood set out to be the full-stack framework JavaScript never had, and much of it landed: generators, cells, Prisma-backed services, auth providers, and background jobs. Stacks wants the same thing and made different choices about the runtime, the transport, and how much of the infrastructure belongs in the repository.',
      summary: 'RedwoodJS pairs a React front end with a services layer, originally over GraphQL and more recently over an RSC-first architecture in Redwood SDK. It leans on Prisma for data, supports several auth providers, and ships generators that scaffold both halves of a feature. Its opinionated, batteries-included stance is the closest philosophical neighbour Stacks has in JavaScript.',
      theirStrengths: [
        { title: 'React and GraphQL maturity', text: 'If you want React on the front and a schema-first API in the middle, Redwood has years of that path worn in.' },
        { title: 'Prisma', text: 'Prisma is a superb, widely known ORM with excellent tooling, and Redwood is built around it.' },
        { title: 'Established community', text: 'Redwood has been shipping since 2020, with a larger user base and more third-party writing than Stacks has.' },
        { title: 'Cells', text: 'The cell pattern for loading, empty, failure, and success states is a genuinely good idea for data-driven interfaces.' },
      ],
      ourStrengths: [
        { title: 'One runtime', text: 'Bun for the server, the tests, the CLI, and the build, with no separate bundler configuration to reconcile.' },
        { title: 'More in the box', text: 'Mail, notifications, SMS, push, search indexing, storage, realtime, commerce, CMS, and an admin dashboard are first-party rather than integrations.' },
        { title: 'Infrastructure included', text: 'DNS, TLS, CDN, and mail records are declared in config and applied by buddy deploy, without a separate infrastructure tool.' },
        { title: 'Model-driven migrations', text: 'Schema comes from the model definitions and is diffed into SQL, rather than being maintained in a separate schema file.' },
      ],
      rows: [
        { dimension: 'Front end', stacks: 'STX components', other: 'React, with RSC in Redwood SDK' },
        { dimension: 'API transport', stacks: 'REST with generated OpenAPI', other: 'GraphQL historically, RSC and server functions now' },
        { dimension: 'Data layer', stacks: 'First-party ORM, models drive migrations', other: 'Prisma schema drives migrations' },
        { dimension: 'Auth', stacks: 'First-party sessions, tokens, passkeys, RBAC', other: 'dbAuth or a third-party provider' },
        { dimension: 'Background jobs', stacks: 'Queues, batches, schedules, workers', other: 'Background jobs with a database queue' },
        { dimension: 'Runtime', stacks: 'Bun', other: 'Node.js' },
        { dimension: 'Admin surface', stacks: 'Dashboard generated from models', other: 'Scaffold generators produce CRUD pages' },
        { dimension: 'Infrastructure', stacks: 'Declared in config/cloud.ts', other: 'Deploy targets and your own IaC' },
      ],
      migration: [
        { title: 'Services become actions', text: 'A Redwood service function is close to a Stacks action: one job, typed input, typed result.' },
        { title: 'Prisma schema becomes models', text: 'Each Prisma model maps to a defineModel() with attributes and relationships, after which migrations are generated for you.' },
        { title: 'GraphQL consumers need a plan', text: 'Stacks is REST-first. A client depending on GraphQL needs either a gateway or a client rewrite.' },
      ],
      verdict: {
        pickThem: 'You want React and GraphQL with an opinionated full-stack structure, and Prisma is a dependency you are happy to build on.',
        pickStacks: 'You want the same completeness but on Bun, over REST, with mail, search, storage, realtime, and the deploy included.',
      },
      related: ['nextjs', 't3-stack', 'adonisjs'],
    },
  },

  {
    slug: 't3-stack',
    name: 'The T3 Stack',
    blurb: 'Best-in-class parts, assembled by you. Stacks is the same territory, maintained as one thing.',
    kind: 'Assembled stack',
    language: 'TypeScript',
    icon: 'i-hugeicons-puzzle',
    group: 'fullstack',
    matrix: { auth: 'partial', orm: 'partial', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'partial' },
    page: {
      headline: 'A stack you assemble, or a framework that arrives assembled.',
      lede: 'T3 is Next.js, tRPC, Prisma or Drizzle, Tailwind, and Auth.js, chosen because each is the strongest in its category and typed end to end. It works. The cost is that you own the seams: five upgrade cadences, five sets of release notes, and every integration point is yours to keep working.',
      summary: 'The T3 Stack is less a framework than a well-argued set of defaults, delivered by create-t3-app. Its central insight, that types should flow from the database to the component without hand-written contracts, is correct and influential. tRPC in particular gives an experience that REST needs code generation to match.',
      theirStrengths: [
        { title: 'Every part is best in class', text: 'Prisma, tRPC, and Tailwind are excellent tools with large communities and deep documentation.' },
        { title: 'tRPC end-to-end types', text: 'For a TypeScript client talking to a TypeScript server, tRPC is a smoother contract than REST plus generated clients.' },
        { title: 'Swap any piece', text: 'Nothing is welded together, so you can replace the ORM or the auth layer without leaving the stack.' },
        { title: 'Enormous shared knowledge', text: 'Every problem you hit has been hit publicly by thousands of others.' },
      ],
      ourStrengths: [
        { title: 'One upgrade, not five', text: 'The pieces version together, and buddy upgrade moves the whole application forward.' },
        { title: 'The parts T3 does not cover', text: 'Queues, mail, storage, search, realtime, notifications, admin, and deploy are the ones you would otherwise choose next.' },
        { title: 'One set of conventions', text: 'Where files go and how a feature is built is answered by the framework, so every project reads the same.' },
        { title: 'Deploy and infrastructure', text: 'T3 ends at the application. Stacks describes and provisions what runs it.' },
      ],
      rows: [
        { dimension: 'What it is', stacks: 'A framework', other: 'A curated set of libraries and a scaffolder' },
        { dimension: 'API contract', stacks: 'REST plus generated OpenAPI and a typed client', other: 'tRPC procedures typed directly' },
        { dimension: 'Data layer', stacks: 'First-party ORM, migrations generated from models', other: 'Prisma or Drizzle, schema maintained separately' },
        { dimension: 'Auth', stacks: 'Included with RBAC, passkeys, and 2FA', other: 'Auth.js, configured per project' },
        { dimension: 'Background work', stacks: 'Included', other: 'Choose a service' },
        { dimension: 'Mail and notifications', stacks: 'Included', other: 'Choose a provider and a library' },
        { dimension: 'Upgrades', stacks: 'One framework version', other: 'Independent versions per library' },
        { dimension: 'Ceiling on choice', stacks: 'Framework conventions, overridable per file', other: 'Anything you want, and anything you maintain' },
      ],
      migration: [
        { title: 'Procedures become actions', text: 'A tRPC procedure and a Stacks action are the same unit of work with a different transport.' },
        { title: 'Schema first', text: 'Port the Prisma or Drizzle schema into models, generate migrations, and check the diff against the existing database before running anything.' },
        { title: 'Clients change transport', text: 'Existing tRPC clients need to move to the generated REST client, which is the largest single piece of the port.' },
      ],
      verdict: {
        pickThem: 'You want maximum control over each layer, tRPC is the contract you want, and maintaining the seams is a price your team is happy to pay.',
        pickStacks: 'You would rather spend that maintenance budget on the product, and you want the layers T3 does not cover.',
      },
      related: ['nextjs', 'redwoodjs', 'nestjs'],
    },
  },

  {
    slug: 'nestjs',
    name: 'NestJS',
    blurb: 'Structured TypeScript backends with dependency injection. Stacks trades DI for conventions.',
    kind: 'Backend framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-server-stack-01',
    group: 'backends',
    matrix: { auth: 'partial', orm: 'partial', jobs: 'partial', mail: 'partial', admin: 'byo', realtime: 'partial', deploy: 'byo' },
    page: {
      headline: 'Modules and injection, or models and conventions.',
      lede: 'NestJS brought Angular-style architecture to the Node backend and gave large teams something to standardise on. Stacks aims at the same problem from the Laravel direction: fewer abstractions to configure, more of the application already written, and no front end left as an exercise.',
      summary: 'Nest is the most widely adopted structured backend framework in TypeScript. Modules, providers, decorators, and dependency injection give large codebases a shape, and the official packages cover configuration, validation, queues via BullMQ, WebSockets, GraphQL, and microservice transports. It is deliberately unopinionated about the database and about the front end.',
      theirStrengths: [
        { title: 'Dependency injection', text: 'For very large teams, constructor injection and testable providers are a real architectural benefit, and Stacks does not offer an equivalent container.' },
        { title: 'Microservice transports', text: 'gRPC, Kafka, NATS, RabbitMQ, and MQTT are first-class in Nest, which matters if the system is many services rather than one application.' },
        { title: 'Adoption and hiring', text: 'Nest is the safe enterprise answer in Node, with a large pool of engineers who already know it.' },
        { title: 'GraphQL', text: 'Code-first and schema-first GraphQL are properly supported, where Stacks is REST-first.' },
      ],
      ourStrengths: [
        { title: 'The database layer is answered', text: 'Nest leaves you to pick TypeORM, Prisma, or Mikro-ORM. Stacks has one ORM, with migrations generated from the models.' },
        { title: 'The front end is included', text: 'STX views, layouts, and assets are part of the same project rather than a separate application.' },
        { title: 'Less ceremony per feature', text: 'A feature is a model, an action, and a route. There is no module, provider, and DTO scaffolding to write first.' },
        { title: 'Operations and deploy', text: 'Admin dashboard, mail, storage, search, and infrastructure come with it.' },
      ],
      rows: [
        { dimension: 'Architecture', stacks: 'Convention-based files, no container', other: 'Modules and dependency injection' },
        { dimension: 'Data layer', stacks: 'First-party ORM', other: 'TypeORM, Prisma, or Mikro-ORM' },
        { dimension: 'Validation', stacks: 'Declared on model attributes', other: 'class-validator DTOs' },
        { dimension: 'Queues', stacks: 'Included, with drivers', other: '@nestjs/bullmq with Redis' },
        { dimension: 'Front end', stacks: 'STX views in the same project', other: 'Separate application' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Build it yourself' },
        { dimension: 'Runtime', stacks: 'Bun', other: 'Node.js' },
        { dimension: 'Deploy', stacks: 'buddy deploy from config', other: 'Your own containers and IaC' },
      ],
      migration: [
        { title: 'Controllers become routes and actions', text: 'A controller method maps to a route pointing at an action; the decorators become route definitions.' },
        { title: 'DTOs become model validation', text: 'class-validator rules move onto attribute validation, where the factory and the generated API also read them.' },
        { title: 'Injection has no direct analogue', text: 'Services become plain modules or actions. Code leaning heavily on the container needs rethinking rather than translating.' },
      ],
      verdict: {
        pickThem: 'You are building a large service estate, you need gRPC or message brokers, or your organisation already standardised on Nest and hires for it.',
        pickStacks: 'You are building one application rather than twelve services, and you want the data layer, the front end, and the operations tooling to come with the framework.',
      },
      related: ['adonisjs', 'express', 't3-stack'],
    },
  },

  {
    slug: 'adonisjs',
    name: 'AdonisJS',
    blurb: 'The other Laravel-inspired TypeScript framework. The closest comparison on this page.',
    kind: 'Backend framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-server-stack-02',
    group: 'backends',
    matrix: { auth: 'built-in', orm: 'built-in', jobs: 'partial', mail: 'built-in', admin: 'byo', realtime: 'partial', deploy: 'byo' },
    page: {
      headline: 'The nearest neighbour, and the most honest comparison here.',
      lede: 'Adonis has been doing batteries-included TypeScript on the server for years, with a real ORM, auth, validation, mail, and templating. If you want that today with a track record behind it, Adonis is a serious answer. Stacks differs in runtime, in how migrations are produced, and in how far past the application it reaches.',
      summary: 'AdonisJS is a mature, well-documented, Laravel-inspired framework for Node. Lucid is a capable Active Record ORM with migrations and factories, the auth package covers sessions and tokens, VineJS handles validation, Edge handles templates, and the CLI scaffolds the lot. Its ecosystem is smaller than Nest but its coherence is much higher.',
      theirStrengths: [
        { title: 'Maturity', text: 'Years of production use, stable releases, and thorough documentation. Stacks is younger and moving faster, which cuts both ways.' },
        { title: 'Lucid', text: 'A well-designed ORM with hand-written migrations, which some teams prefer precisely because they are explicit.' },
        { title: 'Node ecosystem', text: 'Runs on Node with the whole npm operational tooling story behind it, where Stacks targets Bun.' },
        { title: 'Focus', text: 'Adonis does the backend and stops, which is a virtue if you already have a front end you are keeping.' },
      ],
      ourStrengths: [
        { title: 'Migrations from models', text: 'Schema is declared once on the model and diffed into SQL, rather than maintained as a parallel set of migration files.' },
        { title: 'Front end included', text: 'STX views, components, and the asset pipeline are in the same project and share the same types.' },
        { title: 'Beyond the request', text: 'Search indexing, storage, realtime, notifications, SMS, push, commerce, and CMS ship first-party.' },
        { title: 'Deploy and infrastructure', text: 'config/cloud.ts plus buddy deploy provisions the environment, which Adonis leaves to you.' },
        { title: 'An admin dashboard', text: 'Model-driven admin screens, which Adonis does not provide.' },
      ],
      rows: [
        { dimension: 'Runtime', stacks: 'Bun', other: 'Node.js' },
        { dimension: 'ORM', stacks: 'First-party, models generate migrations', other: 'Lucid, with hand-written migrations' },
        { dimension: 'Templating', stacks: 'STX single-file components with signals', other: 'Edge templates' },
        { dimension: 'Validation', stacks: 'On model attributes', other: 'VineJS schemas' },
        { dimension: 'Auth', stacks: 'Sessions, tokens, passkeys, 2FA, RBAC', other: 'Sessions, tokens, and guards' },
        { dimension: 'Queues', stacks: 'First-party with drivers', other: 'Community BullMQ integration' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Build it yourself' },
        { dimension: 'Infrastructure', stacks: 'Declared in config and deployed by the CLI', other: 'Your own' },
      ],
      migration: [
        { title: 'The vocabulary matches', text: 'Controllers, middleware, validators, and models all have direct counterparts, so the port is mostly mechanical.' },
        { title: 'Lucid models become defineModel()', text: 'Columns, relationships, and hooks translate; the migrations then come out of the model rather than moving across.' },
        { title: 'Edge templates become STX', text: 'The directive syntax is close enough that most templates convert with light editing.' },
      ],
      verdict: {
        pickThem: 'You want a proven, stable, backend-only TypeScript framework on Node today, and you already have a front end and a deploy story you are happy with.',
        pickStacks: 'You want the same shape of framework but with the views, the admin, the search, the realtime, and the deploy in the same install, on Bun.',
      },
      related: ['laravel', 'nestjs', 'redwoodjs'],
    },
  },

  {
    slug: 'express',
    name: 'Express and Fastify',
    blurb: 'Minimal HTTP layers. Everything above the router is a decision you make and maintain.',
    kind: 'HTTP frameworks',
    language: 'JavaScript and TypeScript',
    icon: 'i-hugeicons-share-08',
    group: 'backends',
    matrix: { auth: 'byo', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'byo' },
    page: {
      headline: 'A router is not a framework, and sometimes a router is all you want.',
      lede: 'Express and Fastify do one job well: take a request, run some middleware, return a response. That minimalism is why they are everywhere and why every Express codebase is different. Stacks is the opposite trade: conventions and batteries, at the cost of doing things its way.',
      summary: 'Express is the most deployed HTTP framework in JavaScript and the reference implementation of the middleware pattern. Fastify is the modern take: faster, schema-driven, with a well-designed plugin system and first-class TypeScript. Neither has an opinion about data, auth, jobs, or views, and both are excellent when that is what you want.',
      theirStrengths: [
        { title: 'Ubiquity', text: 'Every engineer knows Express, every integration documents it, and it will still be maintained long after most of this page is out of date.' },
        { title: 'Nothing in the way', text: 'For a proxy, a webhook receiver, or a small service, a framework with opinions is overhead you do not need.' },
        { title: 'Fastify performance and schemas', text: 'JSON schema validation and serialisation make Fastify both fast and strict, which is a good combination for high-volume APIs.' },
        { title: 'Plugin ecosystems', text: 'Decades of middleware for anything you might bolt on.' },
      ],
      ourStrengths: [
        { title: 'The application above the router', text: 'Models, migrations, validation, auth, queues, mail, storage, search, and admin, rather than a directory structure you invent.' },
        { title: 'Consistency across projects', text: 'Two Stacks applications look alike. Two Express applications rarely do, and that cost is paid at every handover.' },
        { title: 'Typed end to end', text: 'The route, the action, the model, and the client share types by construction.' },
        { title: 'Deploy included', text: 'Infrastructure in config, applied by the CLI, instead of a bespoke pipeline per service.' },
      ],
      rows: [
        { dimension: 'Scope', stacks: 'Full application framework', other: 'HTTP routing and middleware' },
        { dimension: 'Structure', stacks: 'Prescribed by the framework', other: 'Whatever the team decides' },
        { dimension: 'Data layer', stacks: 'Included', other: 'Choose your own' },
        { dimension: 'Validation', stacks: 'On the model, reused everywhere', other: 'Zod, JSON schema, or your own' },
        { dimension: 'Background work', stacks: 'Included', other: 'Choose your own' },
        { dimension: 'Views', stacks: 'STX in the same project', other: 'Add a template engine or a separate front end' },
        { dimension: 'Best fit', stacks: 'Products and platforms', other: 'Small services and glue' },
        { dimension: 'Runtime', stacks: 'Bun', other: 'Node.js, Bun compatible' },
      ],
      migration: [
        { title: 'Handlers become actions', text: 'Each route handler becomes an action, and shared middleware moves into app/Middleware/.' },
        { title: 'Adopt the ORM last', text: 'A Stacks application can keep talking to your existing database and query builder while routes move over.' },
        { title: 'Move one route group at a time', text: 'Run both, put Stacks behind the new endpoints, and retire the old service when the last route has moved.' },
      ],
      verdict: {
        pickThem: 'The service is small, its job is narrow, or you have strong reasons to control every layer yourself.',
        pickStacks: 'It is a product rather than a service, and the structure you would otherwise invent is structure you would rather inherit.',
      },
      related: ['hono', 'elysia', 'nestjs'],
    },
  },

  {
    slug: 'hono',
    name: 'Hono',
    blurb: 'A tiny, fast, edge-first router. Stacks is the application you would build on top of one.',
    kind: 'Edge HTTP framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-globe',
    group: 'backends',
    matrix: { auth: 'partial', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'byo', deploy: 'byo' },
    page: {
      headline: 'Hono runs anywhere. Stacks runs an application.',
      lede: 'Hono is a few kilobytes of extremely well-made routing that works on Cloudflare Workers, Deno, Bun, Node, and Lambda, with typed middleware and an RPC mode. It is the right tool for edge services. It is not trying to be the place your models, jobs, mail, and admin live.',
      summary: 'Hono has become the default choice for edge and worker runtimes, and deservedly so: a small API, excellent TypeScript inference, a useful set of built-in middleware, and portability across every JavaScript runtime that matters. Its RPC mode gives typed clients without code generation, which is a genuinely nice property.',
      theirStrengths: [
        { title: 'Runtime portability', text: 'One codebase on Workers, Deno, Bun, Node, and Lambda. Stacks targets Bun and does not run at the edge.' },
        { title: 'Cold starts and size', text: 'For workers measured in kilobytes and milliseconds, Hono is in a category Stacks is not competing in.' },
        { title: 'Type inference', text: 'The typed client from route definitions is elegant and needs no generation step.' },
        { title: 'Simplicity', text: 'The whole framework can be read in an afternoon, which is worth a lot for a service you will maintain for years.' },
      ],
      ourStrengths: [
        { title: 'Everything past the handler', text: 'Data, auth, roles, jobs, mail, storage, search, realtime, and admin, rather than middleware you select.' },
        { title: 'A view layer', text: 'Server-rendered pages, layouts, and components in the same project.' },
        { title: 'Long-running work', text: 'Queues, schedules, and workers are a poor fit for edge runtimes and a first-class fit here.' },
        { title: 'Deploy and infrastructure', text: 'Provisioned from config rather than assembled per service.' },
      ],
      rows: [
        { dimension: 'Scope', stacks: 'Full application framework', other: 'Routing and middleware' },
        { dimension: 'Runtimes', stacks: 'Bun', other: 'Workers, Deno, Bun, Node, Lambda' },
        { dimension: 'Client types', stacks: 'Generated client from OpenAPI', other: 'Inferred RPC client' },
        { dimension: 'Data layer', stacks: 'Included', other: 'Choose your own' },
        { dimension: 'Background work', stacks: 'Included', other: 'Queues provided by the platform' },
        { dimension: 'Views', stacks: 'STX', other: 'JSX helper or none' },
        { dimension: 'Best fit', stacks: 'Products, platforms, long-running work', other: 'Edge services, APIs, proxies' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Not applicable' },
      ],
      migration: [
        { title: 'They coexist well', text: 'Keep Hono at the edge for caching, geo routing, or webhooks, and put the application behind it.' },
        { title: 'Handlers become actions', text: 'Route handlers translate directly; the typed RPC client is replaced by the generated one.' },
        { title: 'Watch the runtime assumptions', text: 'Code written for Workers may assume no filesystem and no long-running work, which changes once it lands in a server process.' },
      ],
      verdict: {
        pickThem: 'The workload belongs at the edge, must run on multiple runtimes, or is small enough that a framework would be overhead.',
        pickStacks: 'The workload is an application, with a database, background work, and people who need an admin screen.',
      },
      related: ['elysia', 'express', 'nestjs'],
    },
  },

  {
    slug: 'elysia',
    name: 'Elysia',
    blurb: 'The fastest Bun-native router, with end-to-end types. Stacks is the framework around one.',
    kind: 'Bun HTTP framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-rocket-01',
    group: 'backends',
    matrix: { auth: 'partial', orm: 'byo', jobs: 'byo', mail: 'byo', admin: 'byo', realtime: 'partial', deploy: 'byo' },
    page: {
      headline: 'Both are Bun-first. One is a router, one is an application framework.',
      lede: 'Elysia is the strongest argument for Bun on the server: schema-validated routes, inferred types, an Eden client with no code generation, and throughput at the top of every benchmark. Stacks shares the runtime bet and answers a different question, which is everything you need once the router is chosen.',
      summary: 'Elysia is built for Bun specifically and uses that to do things portable frameworks cannot, including ahead-of-time route compilation. TypeBox schemas validate requests and produce types, plugins compose cleanly, and Eden gives a fully typed client. For a high-performance Bun API it is an excellent choice.',
      theirStrengths: [
        { title: 'Raw performance', text: 'Elysia is faster at the routing layer than a full framework will be, and if requests per second per core is your metric, it wins.' },
        { title: 'Eden', text: 'End-to-end types with no generation step is a smoother developer experience than OpenAPI plus a generated client.' },
        { title: 'Small surface', text: 'Fewer concepts to learn, and nothing you do not use.' },
        { title: 'Plugin composition', text: 'The plugin model is clean and makes sharing behaviour between services straightforward.' },
      ],
      ourStrengths: [
        { title: 'Batteries, not building blocks', text: 'ORM, migrations, auth, RBAC, queues, mail, storage, search, realtime, CMS, commerce, and an admin dashboard.' },
        { title: 'Views and assets', text: 'A front end in the same project, server-rendered, with a component model and styling.' },
        { title: 'Structure that survives growth', text: 'Conventions for where things live, so the tenth feature looks like the first.' },
        { title: 'Deploy and operations', text: 'Infrastructure from config, a dashboard for jobs and mail, and CI that ships on push.' },
      ],
      rows: [
        { dimension: 'Scope', stacks: 'Full application framework', other: 'HTTP framework' },
        { dimension: 'Runtime', stacks: 'Bun', other: 'Bun' },
        { dimension: 'Validation', stacks: 'On model attributes', other: 'TypeBox schemas per route' },
        { dimension: 'Client types', stacks: 'Generated client from OpenAPI', other: 'Eden, inferred' },
        { dimension: 'Data layer', stacks: 'Included', other: 'Choose your own' },
        { dimension: 'Background work', stacks: 'Included', other: 'Choose your own' },
        { dimension: 'Views', stacks: 'STX', other: 'Add a template engine' },
        { dimension: 'Raw throughput', stacks: 'Good, with a framework in the path', other: 'Best in class' },
      ],
      migration: [
        { title: 'Same runtime, so no rewrite of the primitives', text: 'Bun APIs, native SQLite, and package resolution behave the same on both sides.' },
        { title: 'Schemas become model validation', text: 'TypeBox route schemas move onto attributes, where the factory and the generated API also use them.' },
        { title: 'Eden consumers switch clients', text: 'Clients move from Eden to the generated REST client, which is the main piece of work.' },
      ],
      verdict: {
        pickThem: 'The service is an API, throughput is the requirement, and you want the thinnest possible layer over Bun.',
        pickStacks: 'You want the same runtime with the rest of the application already written and typed together.',
      },
      related: ['hono', 'express', 'nestjs'],
    },
  },

  {
    slug: 'encore',
    name: 'Encore.ts',
    blurb: 'Infrastructure from code, for distributed backends. Stacks does it for one application.',
    kind: 'Infrastructure framework',
    language: 'TypeScript',
    icon: 'i-hugeicons-cloud-server',
    group: 'backends',
    matrix: { auth: 'partial', orm: 'partial', jobs: 'built-in', mail: 'byo', admin: 'partial', realtime: 'partial', deploy: 'built-in' },
    page: {
      headline: 'Two frameworks that think infrastructure belongs in the code.',
      lede: 'Encore reads your source, works out which databases, queues, and cron jobs it implies, and provisions them. Stacks reaches the same conclusion from the other end: the infrastructure is declared in config in the repository, and one command applies it. The difference is that Encore is built for many services and Stacks is built for one application.',
      summary: 'Encore.ts declares infrastructure as typed objects in application code, generates the provisioning for local, preview, and production environments, and provides a Rust-based request runtime for performance. Its distributed-systems tooling, including service catalogues, tracing, and preview environments per pull request, is more advanced than anything here.',
      theirStrengths: [
        { title: 'Distributed systems', text: 'Service-to-service calls, tracing, and a service catalogue are built for estates of services, which is not what Stacks optimises for.' },
        { title: 'Preview environments', text: 'An ephemeral environment per pull request, provisioned automatically, is a strong workflow.' },
        { title: 'Observability', text: 'Tracing and metrics are wired in from the start rather than added.' },
        { title: 'Cloud-agnostic provisioning', text: 'AWS and GCP from the same declarations, where Stacks targets AWS.' },
      ],
      ourStrengths: [
        { title: 'The application, not just the backend', text: 'Views, CMS, commerce, admin, and mail are part of the framework rather than services you would write.' },
        { title: 'A data layer with opinions', text: 'Models generate migrations and validation; Encore gives you a database and leaves the ORM to you.' },
        { title: 'No platform account required', text: 'Stacks deploys into your AWS account with no intermediary, which some organisations require.' },
        { title: 'Single-application simplicity', text: 'One deployable, one database, one repository, which is the right shape for most products.' },
      ],
      rows: [
        { dimension: 'Target shape', stacks: 'One application', other: 'Many services' },
        { dimension: 'Infrastructure', stacks: 'Declared in config/cloud.ts', other: 'Inferred from code declarations' },
        { dimension: 'Data layer', stacks: 'First-party ORM', other: 'Provisioned Postgres, ORM of your choice' },
        { dimension: 'Front end', stacks: 'Included', other: 'Separate application' },
        { dimension: 'Background work', stacks: 'Queues, jobs, schedules', other: 'Pub/sub and cron primitives' },
        { dimension: 'Observability', stacks: 'Logs, dashboard, queue history', other: 'Distributed tracing and metrics' },
        { dimension: 'Cloud targets', stacks: 'AWS', other: 'AWS and GCP' },
        { dimension: 'Admin surface', stacks: 'Generated from models', other: 'Developer dashboard, not an app admin' },
      ],
      migration: [
        { title: 'Endpoints become actions', text: 'Encore API endpoints and Stacks actions are the same unit with different decoration.' },
        { title: 'Fold services into one application', text: 'Most Encore services in a small system become modules of one Stacks application, which removes the calls between them.' },
        { title: 'Infrastructure moves to config', text: 'Databases, queues, and cron declarations become config plus app/Scheduler.ts entries.' },
      ],
      verdict: {
        pickThem: 'You are building a distributed backend, you want per-pull-request environments and tracing, and the front end is a separate concern.',
        pickStacks: 'You are building one product, and you want the front end, the admin, and the content layer in the same place as the API.',
      },
      related: ['nestjs', 'elysia', 'adonisjs'],
    },
  },

  {
    slug: 'laravel',
    name: 'Laravel',
    blurb: 'The framework Stacks is modelled on, rebuilt in TypeScript on Bun.',
    kind: 'Full-stack framework',
    language: 'PHP',
    icon: 'i-hugeicons-gem',
    group: 'ecosystems',
    matrix: { auth: 'built-in', orm: 'built-in', jobs: 'built-in', mail: 'built-in', admin: 'partial', realtime: 'built-in', deploy: 'partial' },
    page: {
      headline: 'Everything you like about Laravel, in the language your front end already speaks.',
      lede: 'Stacks does not pretend to be an independent invention. Models, migrations, queues, mail, events, gates, and an expressive CLI are Laravel ideas, and they are good ones. What changes is the language: one TypeScript type graph from the database row to the rendered view, with no boundary in between.',
      summary: 'Laravel is the most complete web framework in any language, and after a decade it shows: Eloquent, queues, Horizon, Echo, Livewire, Filament, Forge, Vapor, Nova, and a community that has written about every problem you will meet. If you are a PHP team, nothing on this page is a reason to leave, and this comparison is not trying to be one.',
      theirStrengths: [
        { title: 'Maturity and ecosystem', text: 'A decade of packages, hosting products, books, courses, and conference talks. Stacks is early and its ecosystem is small by comparison.' },
        { title: 'Hosting is a solved problem', text: 'Forge, Vapor, Cloud, and every shared host on earth run PHP. Deploying Laravel is boring in the best sense.' },
        { title: 'Filament and Nova', text: 'The admin panel ecosystem in Laravel is deeper than the built-in Stacks dashboard, particularly for heavily customised back offices.' },
        { title: 'Hiring', text: 'The pool of experienced Laravel developers is far larger than the pool who have used Stacks.' },
      ],
      ourStrengths: [
        { title: 'One language, one type graph', text: 'The model, the action, the route, the view, and the API client are all TypeScript and all typed against each other. No PHP array to JSON boundary in the middle.' },
        { title: 'Migrations from models', text: 'Schema is declared on the model and diffed into SQL, rather than being maintained twice.' },
        { title: 'Front end in the box', text: 'STX components and signals are part of the framework, so there is no Livewire or Inertia decision to make.' },
        { title: 'Infrastructure in the repository', text: 'DNS, TLS, CDN, and mail records are declared in config and applied by buddy deploy, without a paid platform.' },
        { title: 'One runtime for everything', text: 'The server, the CLI, the tests, and the build all run on Bun, so there is no separate Node toolchain beside the PHP one.' },
        { title: 'No deploy platform subscription', text: 'Forge runs $12 to $39 a month and Vapor $39 a month, both before the AWS bill. buddy deploy ships in the framework itself, so the only recurring cost is the same AWS bill either way.' },
        { title: 'A mail server, not just a mail sender', text: 'Laravel pairs with SES or Postmark for sending and Google Workspace or Fastmail for real mailboxes. Stacks can run its own self-hostable SMTP and IMAP server, so a custom mailbox on your domain is infrastructure you already have rather than another subscription.' },
        { title: 'Real products, not a demo', text: 'BugHQ (bughq.org), StatusHQ (statushq.org), AnalyticsHQ (analyticshq.org), and LogHQ (loghq.org) are Stacks applications running in production today, and all four are open source you can self-host rather than a SaaS you rent. CommsHQ, a marketing and communications platform built the same way, goes further either direction: self-host it for free or take one of its own hosted subscription plans.' },
      ],
      rows: [
        { dimension: 'Language', stacks: 'TypeScript end to end', other: 'PHP on the server, JavaScript on the client' },
        { dimension: 'ORM', stacks: 'defineModel(), migrations generated', other: 'Eloquent, migrations hand-written' },
        { dimension: 'Views', stacks: 'STX components with signals', other: 'Blade, plus Livewire or Inertia' },
        { dimension: 'Queues', stacks: 'Included, dashboard for failures', other: 'Included, Horizon for monitoring' },
        { dimension: 'Realtime', stacks: 'Included', other: 'Echo with Reverb or Pusher' },
        { dimension: 'Admin', stacks: 'Dashboard generated from models', other: 'Filament (free) or Nova (paid, per project)' },
        { dimension: 'Deploy', stacks: 'buddy deploy into your AWS account, no platform fee', other: 'Forge $12-39/mo, Vapor $39/mo+, or Cloud from $5/mo+usage' },
        { dimension: 'Mailboxes', stacks: 'Optional self-hosted SMTP and IMAP server', other: 'A hosted inbox provider, billed separately' },
        { dimension: 'Ecosystem age', stacks: 'Young', other: 'Mature' },
      ],
      migration: [
        { title: 'The concepts carry over unchanged', text: 'Models, migrations, jobs, events, listeners, mail, middleware, and gates all exist here with the same names and much the same shape.' },
        { title: 'Eloquent models become defineModel()', text: 'Fillable, casts, relationships, and observers map onto attributes, traits, and the observe flag. Migrations are then generated rather than ported.' },
        { title: 'Blade becomes STX', text: 'The directives are deliberately familiar, so templates convert more easily than any other framework on this page.' },
        { title: 'Do it service by service', text: 'A Stacks API beside an existing Laravel application, sharing a database, is a workable intermediate step.' },
      ],
      verdict: {
        pickThem: 'Your team writes PHP, or you need the deepest ecosystem and the most proven hosting story available. Laravel remains the benchmark and there is no shame in that being the answer.',
        pickStacks: 'Your team already writes TypeScript for the front end and you would rather not maintain two languages, two toolchains, and a serialisation boundary between them.',
      },
      related: ['adonisjs', 'rails', 'django'],
    },
  },

  {
    slug: 'rails',
    name: 'Ruby on Rails',
    blurb: 'Convention over configuration, the original. Same convictions, different runtime and type story.',
    kind: 'Full-stack framework',
    language: 'Ruby',
    icon: 'i-hugeicons-train-01',
    group: 'ecosystems',
    matrix: { auth: 'partial', orm: 'built-in', jobs: 'built-in', mail: 'built-in', admin: 'partial', realtime: 'built-in', deploy: 'built-in' },
    page: {
      headline: 'Rails proved the case. Stacks argues it again in TypeScript.',
      lede: 'Every framework on this page owes Rails something: convention over configuration, generators, migrations, an ORM with opinions, and the idea that one person should be able to build a whole product. Stacks agrees with all of it and differs on the two things Rails cannot change, which are the language and the runtime.',
      summary: 'Rails is twenty years old and better than ever. Hotwire made server-rendered HTML competitive with single-page applications again, Solid Queue and Solid Cable removed Redis from the default stack, and Kamal made deployment to your own servers straightforward. Its productivity for a small team is still the reference point everyone measures against.',
      theirStrengths: [
        { title: 'Two decades of refinement', text: 'The libraries, the patterns, and the answers to your problem all exist already. Stacks has years of that ahead of it.' },
        { title: 'Hotwire', text: 'Turbo and Stimulus deliver interactivity with almost no client-side state, and the approach is very well proven.' },
        { title: 'Kamal', text: 'Generated into every new Rails 8 app by default. Deploying containers to plain servers with zero downtime, on any host, with no platform lock-in.' },
        { title: 'Culture and hiring', text: 'A large community with strong shared conventions and a deep pool of experienced engineers.' },
      ],
      ourStrengths: [
        { title: 'Static types across the boundary', text: 'Ruby is dynamically typed and Sorbet or RBS is optional. In Stacks the compiler checks the model, the action, the view, and the client together.' },
        { title: 'One language with the front end', text: 'No context switch between Ruby on the server and TypeScript in the browser, and no duplicated types.' },
        { title: 'Schema from models', text: 'The model is the source of truth and migrations are diffed from it, instead of schema.rb being derived from migration history.' },
        { title: 'Infrastructure declared in the repository', text: 'DNS, certificates, CDN, and mail records ship with the application.' },
      ],
      rows: [
        { dimension: 'Language', stacks: 'TypeScript, statically checked', other: 'Ruby, dynamically typed' },
        { dimension: 'ORM', stacks: 'defineModel(), migrations generated', other: 'Active Record, migrations hand-written' },
        { dimension: 'Views', stacks: 'STX with signals', other: 'ERB with Hotwire' },
        { dimension: 'Background work', stacks: 'Queues with drivers', other: 'Active Job with Solid Queue' },
        { dimension: 'Realtime', stacks: 'Channels and model broadcasts', other: 'Action Cable and Turbo Streams' },
        { dimension: 'Auth', stacks: 'Full auth package with RBAC', other: 'Generator plus Devise or Pundit' },
        { dimension: 'Deploy', stacks: 'buddy deploy to AWS from config', other: 'Kamal to any servers' },
        { dimension: 'Admin', stacks: 'Generated dashboard', other: 'ActiveAdmin or Avo' },
      ],
      migration: [
        { title: 'Active Record models become defineModel()', text: 'Associations, validations, callbacks, and scopes have direct counterparts as relationships, attribute rules, and traits.' },
        { title: 'Controllers become actions', text: 'A controller action is a Stacks action; strong parameters become model-declared validation.' },
        { title: 'Jobs move nearly unchanged', text: 'Active Job classes and Stacks jobs have the same shape, including retries and queues.' },
      ],
      verdict: {
        pickThem: 'Your team is Ruby, or you want the most refined convention-driven framework in existence with two decades of answers behind it.',
        pickStacks: 'You want those conventions with static types across the whole stack, and one language shared with the browser.',
      },
      related: ['laravel', 'django', 'adonisjs'],
    },
  },

  {
    slug: 'django',
    name: 'Django',
    blurb: 'Batteries included, and the best free admin in the business. Stacks brings that idea to TypeScript.',
    kind: 'Full-stack framework',
    language: 'Python',
    icon: 'i-hugeicons-dashboard-square-01',
    group: 'ecosystems',
    matrix: { auth: 'built-in', orm: 'built-in', jobs: 'byo', mail: 'built-in', admin: 'built-in', realtime: 'partial', deploy: 'byo' },
    page: {
      headline: 'Django got there first on the admin. Stacks generates one too, in your language.',
      lede: 'Django has been the batteries-included argument for twenty years, and its admin is still the single best reason to choose it. Stacks makes the same argument for TypeScript teams, and adds the parts Django leaves out, which are the background workers, the front end, and the deploy.',
      summary: 'Django gives you an ORM with sound migrations, an auth and permissions system, forms, and an admin site generated from your models that is genuinely production-usable. Django REST Framework and Ninja cover APIs, Channels covers WebSockets, and the whole thing sits in the Python ecosystem, which is where the data and machine learning tooling lives.',
      theirStrengths: [
        { title: 'The admin', text: 'Django admin is more capable out of the box than most admin panels teams build, and it has twenty years of extension points.' },
        { title: 'The Python ecosystem', text: 'If your product involves data science, notebooks, or machine learning libraries, being in Python is worth more than anything on this page.' },
        { title: 'Migrations', text: 'Django migrations are mature, dependable, and well understood by every Python developer.' },
        { title: 'Stability', text: 'Long-term support releases and a strong deprecation policy, which large institutions rely on.' },
      ],
      ourStrengths: [
        { title: 'Background work included', text: 'Django has no queue: you add Celery and a broker. Stacks ships queues, batches, schedules, and workers.' },
        { title: 'One language with the browser', text: 'No Python on one side and TypeScript on the other, and no hand-written types across the API.' },
        { title: 'Front end in the framework', text: 'STX views and components rather than Django templates plus a separate JavaScript build.' },
        { title: 'Deploy from config', text: 'Infrastructure, DNS, and certificates in the repository, applied by one command.' },
      ],
      rows: [
        { dimension: 'Language', stacks: 'TypeScript', other: 'Python' },
        { dimension: 'ORM', stacks: 'defineModel(), migrations generated', other: 'Django ORM, migrations generated' },
        { dimension: 'Admin', stacks: 'Dashboard generated from models', other: 'Django admin, the category benchmark' },
        { dimension: 'API layer', stacks: 'Generated REST plus OpenAPI', other: 'DRF or Django Ninja' },
        { dimension: 'Background work', stacks: 'Included', other: 'Celery plus a broker' },
        { dimension: 'Realtime', stacks: 'Included', other: 'Channels' },
        { dimension: 'Front end', stacks: 'STX in the same project', other: 'Templates or a separate SPA' },
        { dimension: 'Deploy', stacks: 'buddy deploy from config', other: 'Your own containers and IaC' },
      ],
      migration: [
        { title: 'Models translate directly', text: 'Django model fields and Stacks attributes line up almost one to one, including validation and defaults.' },
        { title: 'Views become actions', text: 'Function and class-based views become actions; DRF serializers become model validation and API resources.' },
        { title: 'Celery becomes jobs', text: 'Tasks become job classes with retries and queues declared on them, and the broker choice becomes a config line.' },
      ],
      verdict: {
        pickThem: 'You are a Python team, or the product needs the scientific and machine learning ecosystem that only Python has.',
        pickStacks: 'You want the same completeness, plus queues and a front end, without maintaining Python and TypeScript in one product.',
      },
      related: ['laravel', 'rails', 'nestjs'],
    },
  },

  {
    slug: 'supabase',
    name: 'Supabase',
    blurb: 'A hosted Postgres platform, not a framework. The two are often used together.',
    kind: 'Backend as a service',
    language: 'Any client language',
    icon: 'i-hugeicons-database',
    group: 'ecosystems',
    matrix: { auth: 'hosted', orm: 'hosted', jobs: 'partial', mail: 'partial', admin: 'hosted', realtime: 'hosted', deploy: 'hosted' },
    page: {
      headline: 'Supabase gives you a backend. Stacks gives you somewhere to put your logic.',
      lede: 'This is the least like-for-like comparison on the page, and worth making because teams genuinely choose between them. Supabase is a hosted Postgres with auth, storage, realtime, and edge functions in front of it. Stacks is a framework you run. Plenty of applications use both.',
      summary: 'Supabase is an excellent product: real Postgres you can take with you, row level security, generated APIs, auth with many providers, storage, realtime subscriptions, vector search, and a good dashboard. For a client-heavy application it removes an entire tier of work, and the open-source core means the exit path is a database dump rather than a rewrite.',
      theirStrengths: [
        { title: 'No backend to run at all', text: 'For a mobile or single-page application, talking straight to Supabase from the client is genuinely less work than any framework.' },
        { title: 'Postgres, properly', text: 'Extensions, row level security, and full SQL, hosted competently, with a real migration path off it.' },
        { title: 'Auth breadth', text: 'Social providers, magic links, and multi-factor configured in a dashboard rather than written.' },
        { title: 'Speed to first version', text: 'A working prototype in an afternoon is a real advantage when validating an idea.' },
      ],
      ourStrengths: [
        { title: 'Business logic has a home', text: 'Anything beyond CRUD ends up in database functions, triggers, or edge functions in a BaaS. Here it is actions, jobs, and events in one typed codebase.' },
        { title: 'Auth and authorisation you can read', text: 'Social login, magic links, and two-factor come from the same auth package as password login, just as code rather than a dashboard toggle. Row level security policies are powerful and easy to get subtly wrong; gates and policies are ordinary reviewable TypeScript instead.' },
        { title: 'Background work and mail', text: 'Queues, schedules, retries, transactional mail, and notifications, rather than cron extensions and a mail provider.' },
        { title: 'You own the deployment', text: 'Your AWS account, your database, your bill, and no platform between you and it.' },
      ],
      rows: [
        { dimension: 'What it is', stacks: 'A framework you run', other: 'A hosted platform you consume' },
        { dimension: 'Database', stacks: 'SQLite, MySQL, or Postgres, yours', other: 'Hosted Postgres' },
        { dimension: 'Logic layer', stacks: 'Actions, jobs, events, middleware', other: 'Edge functions and database functions' },
        { dimension: 'Authorisation', stacks: 'Gates and policies in TypeScript', other: 'Row level security in SQL' },
        { dimension: 'Background work', stacks: 'First-class queues and schedules', other: 'pg_cron and queue extensions' },
        { dimension: 'Front end', stacks: 'Included', other: 'Bring your own' },
        { dimension: 'Admin', stacks: 'Generated from your models', other: 'Platform dashboard over tables' },
        { dimension: 'Operating model', stacks: 'You deploy and run it', other: 'Managed, with self-hosting possible' },
      ],
      migration: [
        { title: 'They work well together', text: 'Point a Stacks application at a Supabase Postgres instance and keep the storage and auth you already use while logic moves into the framework.' },
        { title: 'Tables become models', text: 'Generate models from the existing schema, then let migrations be diffed from them going forward.' },
        { title: 'Policies become gates', text: 'Each row level security policy becomes a gate or a query scope, which is usually where the subtle bugs get found.' },
      ],
      verdict: {
        pickThem: 'The application is mostly a client talking to a database, you want no servers to operate, and the logic fits in the database and a few functions.',
        pickStacks: 'The interesting part is the logic between the request and the row, and you want it in one typed, testable, reviewable codebase.',
      },
      related: ['firebase', 'nextjs', 'laravel'],
    },
  },

  {
    slug: 'firebase',
    name: 'Firebase',
    blurb: 'Client-first sync and mobile SDKs. Stacks is the server-first alternative you own.',
    kind: 'Backend as a service',
    language: 'Any client language',
    icon: 'i-hugeicons-satellite-02',
    group: 'ecosystems',
    matrix: { auth: 'hosted', orm: 'hosted', jobs: 'partial', mail: 'partial', admin: 'hosted', realtime: 'hosted', deploy: 'hosted' },
    page: {
      headline: 'Firebase syncs data to clients. Stacks runs the application in the middle.',
      lede: 'Firebase is built on the idea that the client is the application and the backend is a synchronised document store. That is a genuinely good fit for chat, presence, and offline-first mobile apps. It is a poor fit for anything with reporting, invoicing, or complex authorisation, and that is where Stacks is aimed.',
      summary: 'Firebase gives you realtime document sync, offline persistence, authentication, cloud functions, hosting, crash reporting, and analytics, with the best mobile SDKs in the category. For a small team shipping a mobile product it removes an enormous amount of work, and the free tier carries a project a long way.',
      theirStrengths: [
        { title: 'Offline and sync', text: 'Local persistence and conflict handling on mobile is hard, and Firestore does it well. Stacks has no equivalent.' },
        { title: 'Mobile SDK quality', text: 'iOS and Android SDKs, push, crash reporting, and analytics from one vendor with one integration.' },
        { title: 'Zero operations', text: 'No servers, no scaling decisions, and no on-call rota.' },
        { title: 'Time to first release', text: 'For a prototype or a small consumer app, nothing here is faster to ship.' },
      ],
      ourStrengths: [
        { title: 'Queries that are not a compromise', text: 'Joins, aggregates, transactions, and reporting are ordinary SQL rather than denormalised documents and fan-out writes.' },
        { title: 'Security rules become code', text: 'Authorisation lives in gates and policies you can unit test, instead of a rules language with its own failure modes.' },
        { title: 'Cost predictability', text: 'Firebase bills per read and per write, and a bad query is a bad invoice. A server and a database have a shape you can forecast.' },
        { title: 'No lock-in', text: 'Your data is in your own SQL database, and the application that reads it is yours.' },
      ],
      rows: [
        { dimension: 'Data model', stacks: 'Relational, with migrations', other: 'Documents, denormalised' },
        { dimension: 'Queries', stacks: 'Full SQL, joins, aggregates, transactions', other: 'Document queries with index constraints' },
        { dimension: 'Authorisation', stacks: 'Gates and policies in TypeScript', other: 'Security rules' },
        { dimension: 'Realtime', stacks: 'Channels and model broadcasts', other: 'Document subscriptions with offline sync' },
        { dimension: 'Background work', stacks: 'Queues, schedules, retries', other: 'Cloud Functions and scheduled functions' },
        { dimension: 'Mobile', stacks: 'Native builds against your own API', other: 'First-party SDKs with offline support' },
        { dimension: 'Cost model', stacks: 'Infrastructure you provision', other: 'Per operation' },
        { dimension: 'Portability', stacks: 'Your database, your servers', other: 'Vendor specific' },
      ],
      migration: [
        { title: 'Flatten the documents first', text: 'Collections become tables and models, and the denormalisation Firestore required usually disappears.' },
        { title: 'Cloud Functions become jobs and actions', text: 'Triggered functions become model event listeners; scheduled functions become entries in app/Scheduler.ts.' },
        { title: 'Keep the client SDKs if you want', text: 'A phased move can leave auth and push with Firebase while the data layer moves.' },
      ],
      verdict: {
        pickThem: 'The product is a mobile or consumer app that needs offline sync and realtime documents, and you want no infrastructure at all.',
        pickStacks: 'The product has relational data, reporting, billing, or authorisation rules complex enough to want tests and code review.',
      },
      related: ['supabase', 'nextjs', 'adonisjs'],
    },
  },
]

export function comparisonBySlug(slug: string): Comparison | undefined {
  return comparisons.find(comparison => comparison.slug === slug)
}

export function comparisonsInGroup(group: string): Comparison[] {
  return comparisons.filter(comparison => comparison.group === group)
}
