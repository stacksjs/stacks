/**
 * The use cases, in one place.
 *
 * Same arrangement as resources/data/features.ts, and for the same reason:
 * three surfaces read this list (the Use cases mega menu, the /use-cases
 * overview, and the /use-cases/:slug pages), so a use case is one entry here
 * and no new file, and the three cannot disagree about what Stacks is for.
 *
 * Where features.ts answers "what does it ship", this answers "what do I
 * build with it". `stack` is the bridge: every entry lists the feature slugs
 * a build of this shape leans on, which the page renders as links back into
 * /features. A slug that names nothing is a dead link on three pages at
 * once, so tests/unit/marketing-use-cases.test.ts pins it.
 */

export interface UseCasePoint {
  title: string
  text: string
}

export interface UseCaseCode {
  /** Shown in the window title bar, so it should be a path a reader recognises. */
  file: string
  code: string
}

export interface UseCase {
  slug: string
  title: string
  /** One line. The mega menu and the overview card both show this. */
  blurb: string
  icon: string
  group: 'products' | 'workloads' | 'teams'
  page: {
    kicker: string
    headline: string
    lede: string
    /** The work this shape of project always turns out to involve. */
    challenges: UseCasePoint[]
    /** What is already in the box for it. */
    capabilities: UseCasePoint[]
    /** Feature slugs from features.ts. Rendered as links to /features/:slug. */
    stack: string[]
    code: UseCaseCode
    commands: string[]
    docs: string
    /** Slugs of other use cases. Rendered as cards at the foot of the page. */
    related: string[]
  }
}

export const useCaseGroups = [
  { id: 'products', title: 'Products', text: 'The thing you are shipping to the people who use it.' },
  { id: 'workloads', title: 'Workloads', text: 'The shape of the work, whoever ends up looking at it.' },
  { id: 'teams', title: 'Teams', text: 'Who is building it, and what that changes about the choice.' },
] as const

export const useCases: UseCase[] = [
  {
    slug: 'saas',
    title: 'SaaS applications',
    blurb: 'Accounts, teams, billing, jobs, and an admin panel on day one.',
    icon: 'i-hugeicons-rocket-01',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'The boring three months of a SaaS are already written.',
      lede: 'Every subscription product needs the same foundation before it can charge anyone: sign-up, sessions, teams, roles, billing, transactional mail, a job queue, and somewhere for support to look things up. Stacks ships all of it, wired to the same models your product code uses.',
      challenges: [
        { title: 'Auth is never just login', text: 'Sessions, password resets, email verification, two-factor, passkeys, API tokens, and rate limits all arrive together the moment you have paying users.' },
        { title: 'Teams change every table', text: 'Retro-fitting an owning team onto a schema built for single users is the migration nobody enjoys. It is cheaper to have it from the start.' },
        { title: 'Billing leaks into everything', text: 'Plans gate features, invoices need storing, webhooks need to be idempotent, and dunning mail has to send itself.' },
        { title: 'Support needs a window', text: 'Without an admin surface, every refund and every "what did this account do" becomes a database console session.' },
      ],
      capabilities: [
        { title: 'Accounts and teams', text: 'The useAuth trait adds the auth columns and passkeys; teams, invitations, and roles ship as first-party models with their own actions and routes.' },
        { title: 'Roles and gates', text: 'RBAC plus app/Gates.ts policies decide what a member of a team can do, checked the same way in a route, an action, and a view.' },
        { title: 'Billing', text: 'The billable trait puts customers, subscriptions, invoices, and payment methods on a model, with Stripe wired up and webhook handling included.' },
        { title: 'Lifecycle mail', text: 'Welcome, verification, receipt, and dunning mail are Mail classes rendered from STX templates and queued like any other job.' },
        { title: 'Admin dashboard', text: 'The built-in dashboard reads your models, so accounts, subscriptions, and jobs are browsable on day one without you building a back office.' },
        { title: 'Usage and limits', text: 'Rate limiting, feature flags, and queue-backed metering are configuration rather than a service you add later.' },
      ],
      stack: ['auth', 'application-core', 'queues-and-mail', 'dashboard'],
      code: {
        file: 'app/Models/Team.ts',
        code: `import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'Team',
  table: 'teams',

  traits: {
    useUuid: true,
    useTimestamps: true,
    billable: true,
    useApi: { uri: 'teams' },
  },

  hasMany: ['Project', 'Invitation'],
  belongsToMany: ['User'],
})`,
      },
      commands: [
        'buddy new my-saas',
        'buddy migrate --auth',
        'buddy dev',
      ],
      docs: '/docs',
      related: ['multi-tenant-platforms', 'internal-tools', 'startups'],
    },
  },

  {
    slug: 'ecommerce',
    title: 'Online stores',
    blurb: 'Products, carts, checkout, payments, shipping, tax, and receipts.',
    icon: 'i-hugeicons-shopping-cart-01',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'A storefront where the cart and the admin share one schema.',
      lede: 'The commerce package is not a plugin bolted to the side of the framework. It is 35-plus models with the same defineModel() shape as everything else, which is why a product page, the checkout, the fulfilment screen, and the nightly report all read the same rows without an integration layer between them.',
      challenges: [
        { title: 'Money is unforgiving', text: 'Totals, discounts, tax, and refunds have to agree across the storefront, the receipt, the payment provider, and the ledger.' },
        { title: 'Checkout is a state machine', text: 'Stock reservation, payment intents, webhook confirmation, and failure recovery all have to survive a browser closing mid-flow.' },
        { title: 'Someone has to run the shop', text: 'Orders get edited, refunded, and re-shipped by people who are not developers.' },
        { title: 'Catalogue work never stops', text: 'Variants, coupons, gift cards, and seasonal pricing arrive after launch, not before it.' },
      ],
      capabilities: [
        { title: 'Catalogue', text: 'Products, variants, categories, collections, and reviews, each a model you can extend in app/Models/ rather than fork.' },
        { title: 'Checkout and payments', text: 'Carts, orders, coupons, gift cards, and Stripe payments including webhooks, refunds, and stored payment methods.' },
        { title: 'Shipping and tax', text: 'Zones, rates, methods, and tax rules live in config and models, so a quote at checkout and an invoice line come from the same calculation.' },
        { title: 'Receipts and mail', text: 'Order confirmation, shipping, and refund mail render from STX templates and go out through the queue.' },
        { title: 'Storefront and admin', text: 'STX views for the shop and a commerce dashboard for the people running it, both against the same models.' },
        { title: 'Search that stays fresh', text: 'The useSearch trait indexes catalogue changes as they happen, through Meilisearch or Algolia.' },
      ],
      stack: ['commerce', 'application-core', 'realtime-and-search', 'queues-and-mail'],
      code: {
        file: 'app/Actions/Checkout.ts',
        code: `import { Action } from '@stacksjs/actions'
import { commerce } from '@stacksjs/commerce'

export default new Action({
  name: 'Checkout',
  handle: async (request) => {
    const cart = await commerce.carts.find(
      request.get('cart_id'),
    )

    const order = await commerce.orders.createFrom(cart)

    return await commerce.payments.charge(order)
  },
})`,
      },
      commands: [
        'buddy migrate',
        'buddy seed',
        'buddy dev',
      ],
      docs: '/docs',
      related: ['marketplaces', 'content-sites', 'internal-tools'],
    },
  },

  {
    slug: 'marketplaces',
    title: 'Marketplaces',
    blurb: 'Two-sided products where sellers and payouts matter as much as sales.',
    icon: 'i-hugeicons-store-01',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'Two sides, one schema, one deploy.',
      lede: 'A marketplace is a store plus a second application for the people supplying it, and the hard part is that both halves write to the same rows. Stacks gives you the commerce models, the team and role system for sellers, and the queue that moves money and mail between them without a second service.',
      challenges: [
        { title: 'Sellers need their own app', text: 'Listings, inventory, orders, and payouts are a whole product, and it has to see exactly the slice of data that belongs to that seller.' },
        { title: 'Money moves twice', text: 'A buyer pays the platform and the platform pays a seller, on different schedules, with fees in between.' },
        { title: 'Trust is a feature', text: 'Reviews, reports, and moderation queues are launch requirements, not a phase two.' },
        { title: 'Search decides the experience', text: 'A catalogue nobody wrote is a catalogue nobody can filter unless indexing is automatic.' },
      ],
      capabilities: [
        { title: 'Scoped ownership', text: 'Teams, roles, and gates scope every query to a seller, so a seller dashboard is the same actions with a policy in front.' },
        { title: 'Commerce primitives', text: 'Products, orders, coupons, and payments already exist; the marketplace part is the ownership column and the payout job.' },
        { title: 'Payout workflows', text: 'Scheduled jobs, batches, and retries move ledgers on a cadence, with failures visible in the dashboard rather than in a log file.' },
        { title: 'Moderation surfaces', text: 'The commentable and likeable traits plus dashboard model views give you review and report queues without a bespoke admin.' },
        { title: 'Notifications both ways', text: 'Buyers and sellers get mail, SMS, and push from the same notification classes, routed per recipient.' },
        { title: 'Faceted search', text: 'Searchable and filterable attributes are declared on the model, so a new facet is a model edit, not an indexer rewrite.' },
      ],
      stack: ['commerce', 'auth', 'queues-and-mail', 'realtime-and-search'],
      code: {
        file: 'app/Jobs/PayoutSellers.ts',
        code: `import { Every } from '@stacksjs/scheduler'

export default {
  name: 'PayoutSellers',
  queue: 'payouts',
  tries: 3,
  rate: Every.Day,

  async handle() {
    const due = await Payout.where('status', 'due').all()

    for (const payout of due)
      await payout.settle()
  },
}`,
      },
      commands: [
        'buddy make:model Seller',
        'buddy generate:migrations',
        'buddy queue:work',
      ],
      docs: '/docs',
      related: ['ecommerce', 'multi-tenant-platforms', 'background-jobs'],
    },
  },

  {
    slug: 'content-sites',
    title: 'Content sites and blogs',
    blurb: 'Posts, authors, categories, comments, feeds, and sitemaps.',
    icon: 'i-hugeicons-note-edit',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'The CMS is part of the app, not a service you integrate.',
      lede: 'Publishing tools usually arrive as a second system with its own database, its own login, and an API in the middle. Stacks ships posts, authors, pages, categories, tags, and comments as models in the same application, so an editor screen and a public page are two views over one row.',
      challenges: [
        { title: 'Two systems, one truth', text: 'A headless CMS means every content change crosses a network boundary and every type is hand-written on the far side.' },
        { title: 'Editors are users too', text: 'Drafts, scheduling, roles, and previews need auth that the public site already has.' },
        { title: 'Feeds and SEO are silent', text: 'A missing sitemap or a broken canonical tag never throws; it just costs traffic for months.' },
        { title: 'Media adds up', text: 'Uploads, variants, and CDN URLs need somewhere to live that works the same locally and in production.' },
      ],
      capabilities: [
        { title: 'Content models', text: 'Posts, pages, authors, categories, tags, and comments ship as first-party models, extendable in app/Models/.' },
        { title: 'Editing surface', text: 'Dashboard content views cover drafts, scheduling, and moderation without a bespoke admin build.' },
        { title: 'Markdown and STX', text: 'Long-form content lives in content/ as markdown or renders through STX views, with the same layouts as the rest of the site.' },
        { title: 'Feeds, sitemaps, SEO', text: 'RSS, sitemap, canonical, and Open Graph output come from the same content, generated rather than typed.' },
        { title: 'Media pipeline', text: '@stacksjs/storage handles uploads locally and on S3 behind one API, with image variants generated on demand.' },
        { title: 'Full-text search', text: 'The useSearch trait indexes posts as they publish, so site search is a trait flag rather than a service.' },
      ],
      stack: ['cms', 'storage', 'realtime-and-search', 'application-core'],
      code: {
        file: 'app/Models/Post.ts',
        code: `import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'Post',
  table: 'posts',

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: { searchable: ['title', 'body'] },
    categorizable: true,
    taggable: true,
    commentable: true,
  },

  belongsTo: ['Author'],
})`,
      },
      commands: [
        'buddy make:model Post',
        'buddy migrate',
        'buddy dev',
      ],
      docs: '/docs',
      related: ['marketing-sites', 'documentation', 'agencies'],
    },
  },

  {
    slug: 'marketing-sites',
    title: 'Marketing sites',
    blurb: 'Fast pages with forms, analytics, and a CMS behind them.',
    icon: 'i-hugeicons-megaphone-02',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'This page is a Stacks app.',
      lede: 'stacksjs.com is STX views, one shared data file, and the same deploy command the API uses. A marketing site usually starts static and then needs a form, a newsletter, a blog, and an A/B test. Here those are features already in the install rather than four more services on the invoice.',
      challenges: [
        { title: 'Static until it is not', text: 'The first form, the first gated download, or the first personalised block is where a static generator stops being enough.' },
        { title: 'Performance is the product', text: 'Marketing pages are judged on first paint, and every third-party script is a tax on it.' },
        { title: 'Content changes hourly', text: 'Copy, pricing, and launch dates move faster than deploys if editors cannot touch them.' },
        { title: 'Tracking without the creep', text: 'Analytics has to exist, and increasingly it has to be first-party and privacy-preserving.' },
      ],
      capabilities: [
        { title: 'STX views', text: 'Single-file components with server and client scripts, layouts, and partials, rendered on the server with no build config to own.' },
        { title: 'Forms that go somewhere', text: 'Newsletter, contact, and lead forms post to actions, validate against the same schema, and queue their mail.' },
        { title: 'Crosswind styling', text: 'Utility CSS with a design-token layer, dark mode, and no runtime cost on the page.' },
        { title: 'Content behind it', text: 'The CMS models are there when a landing page becomes a resource library.' },
        { title: 'First-party analytics', text: 'Fathom or the self-hosted driver, configured in config/analytics.ts, without a tag manager.' },
        { title: 'Deploys in one command', text: 'buddy deploy builds the site, publishes the CDN, and updates DNS and certificates from config/cloud.ts.' },
      ],
      stack: ['application-core', 'cms', 'cloud-deploys', 'storage'],
      code: {
        file: 'resources/views/index.stx',
        code: `<script server>
import { features } from '../data/features'

const pageTitle = 'Stacks'
</script>

<main>
  @foreach (features as feature)
    <a href="/features/{{ feature.slug }}">
      <h3>{{ feature.title }}</h3>
      <p>{{ feature.blurb }}</p>
    </a>
  @endforeach
</main>`,
      },
      commands: [
        'buddy make:page pricing',
        'buddy dev frontend',
        'buddy deploy',
      ],
      docs: '/docs',
      related: ['content-sites', 'documentation', 'agencies'],
    },
  },

  {
    slug: 'documentation',
    title: 'Documentation sites',
    blurb: 'Markdown docs, search, and API references that ship with the code.',
    icon: 'i-hugeicons-book-open-01',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'Docs that ship in the same deploy as the code.',
      lede: 'Documentation drifts when it lives in a different repository with a different pipeline. Stacks builds docs from markdown in the same project, generates the OpenAPI reference from the routes that actually exist, and publishes both with the application.',
      challenges: [
        { title: 'Drift is the default', text: 'A separate docs site is a separate release cadence, and the gap between them is measured in wrong examples.' },
        { title: 'API references rot fastest', text: 'Hand-written endpoint tables are stale the moment a route changes.' },
        { title: 'Search is expected', text: 'Readers give a docs site one query before they leave for the issue tracker.' },
        { title: 'Versioning is structural', text: 'Deciding it after launch means rewriting every URL you already published.' },
      ],
      capabilities: [
        { title: 'Markdown, built in', text: 'docs/ becomes a site with navigation, sidebar, and theming through the docs build, configured in config/docs.ts.' },
        { title: 'Generated API reference', text: 'buddy generate:openapi reads the routes and resources you defined, so the reference describes the running app.' },
        { title: 'One deploy', text: 'The docs subdomain, its certificate, and its CDN are declared in config/cloud.ts next to the app.' },
        { title: 'Search included', text: 'Client-side or Meilisearch-backed search over the same content, without a crawler to schedule.' },
        { title: 'Shared theme', text: 'Docs, blog, and marketing pages read one palette, so the product does not change identity mid-click.' },
        { title: 'Examples that compile', text: 'Snippets can live in the repository and be type-checked by the same tsc run as the app.' },
      ],
      stack: ['application-core', 'cloud-deploys', 'realtime-and-search', 'testing'],
      code: {
        file: 'config/docs.ts',
        code: `export default {
  base: '/docs',
  title: 'Stacks Docs',

  nav: [
    { text: 'Guide', link: '/guide/' },
    { text: 'API', link: '/api/' },
  ],

  sidebar: {
    '/guide/': [
      { text: 'Install', link: '/guide/install' },
      { text: 'Routing', link: '/guide/routing' },
    ],
  },
}`,
      },
      commands: [
        'buddy dev docs',
        'buddy generate:openapi',
        'buddy build docs',
      ],
      docs: '/docs',
      related: ['open-source-libraries', 'apis', 'marketing-sites'],
    },
  },

  {
    slug: 'mobile-and-desktop',
    title: 'Mobile and desktop apps',
    blurb: 'Native iOS, Android, and desktop builds on the same typed API.',
    icon: 'i-hugeicons-smart-phone-01',
    group: 'products',
    page: {
      kicker: 'Products',
      headline: 'One backend, three places to install it.',
      lede: 'Most mobile projects begin as a second codebase against an API that was never designed for them. Stacks builds native iOS and Android apps and desktop binaries from the same project, against the same typed API client, so a field rename breaks the build instead of the app store release.',
      challenges: [
        { title: 'The API is the contract', text: 'Two codebases means two sets of hand-written types, and only one of them gets updated.' },
        { title: 'Auth on a device is different', text: 'Tokens, refresh, biometrics, and deep links do not behave like a browser session.' },
        { title: 'Push is infrastructure', text: 'Certificates, tokens, and per-platform payloads outlive whoever set them up.' },
        { title: 'Release engineering', text: 'Signing, notarising, and store submission is where a hobby project stalls.' },
      ],
      capabilities: [
        { title: 'Native builds', text: 'The Craft bridge produces iOS and Android apps and desktop binaries from the project, driven by buddy commands.' },
        { title: 'Shared types', text: 'The generated API client is typed from the same models the server uses, so the compiler catches contract drift.' },
        { title: 'Device auth', text: 'Token auth, passkeys, and two-factor come from the same auth package as the web session.' },
        { title: 'Push notifications', text: 'APNs and FCM are notification channels beside mail and SMS, with one class per notification.' },
        { title: 'Offline-friendly data', text: 'Queue-backed sync jobs and realtime channels keep a device current without a bespoke protocol.' },
        { title: 'Signing and delivery', text: 'Build and release steps live in the same CI workflow as the web deploy.' },
      ],
      stack: ['native-apps', 'auth', 'realtime-and-search', 'application-core'],
      code: {
        file: 'app/Notifications/OrderShipped.ts',
        code: `export default {
  name: 'OrderShipped',

  via: () => ['push', 'mail'],

  toPush: (order) => ({
    title: 'On its way',
    body: 'Order ' + order.number + ' has shipped.',
    data: { orderId: order.id },
  }),
}`,
      },
      commands: [
        'buddy build mobile',
        'buddy dev desktop',
        'buddy deploy',
      ],
      docs: '/docs',
      related: ['apis', 'realtime', 'saas'],
    },
  },

  {
    slug: 'apis',
    title: 'APIs and backends',
    blurb: 'Typed REST endpoints, validation, auth, and a generated spec.',
    icon: 'i-hugeicons-share-08',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'The endpoint, its validation, and its documentation come from one file.',
      lede: 'A model with the useApi trait generates its own actions and routes, validated by the rules already declared on its attributes. What ships is a typed API, an OpenAPI spec that matches it, and a client that fails to compile when the contract changes.',
      challenges: [
        { title: 'Three copies of every field', text: 'The migration, the validator, and the response type usually live apart, and they disagree quietly.' },
        { title: 'Docs describe last quarter', text: 'A hand-maintained spec is fiction within a sprint of the code moving.' },
        { title: 'Auth per endpoint', text: 'Tokens, scopes, per-route rate limits, and CORS have to be right on every route, not most of them.' },
        { title: 'Versioning arrives late', text: 'The second consumer is when v1 has to keep working while v2 exists.' },
      ],
      capabilities: [
        { title: 'Generated endpoints', text: 'useApi on a model produces index, store, show, update, and destroy actions plus their routes, each overridable in app/Actions/.' },
        { title: 'One validation source', text: 'Attribute rules validate the request, drive the factory, and describe the schema in the spec.' },
        { title: 'Route groups and middleware', text: 'Prefixes, named routes, model binding, middleware groups, and per-route rate limits live in routes/.' },
        { title: 'OpenAPI output', text: 'buddy generate:openapi emits the spec from the routes that exist, so the reference cannot drift from the app.' },
        { title: 'Token and session auth', text: 'API tokens with scopes, session cookies, and two-factor all come from the auth package.' },
        { title: 'Typed HTTP client', text: 'The fetch client is generated against the same types, so a renamed field is a compile error in the consumer.' },
      ],
      stack: ['application-core', 'auth', 'testing', 'cloud-deploys'],
      code: {
        file: 'routes/api.ts',
        code: `import { route } from '@stacksjs/router'

route.group({ prefix: '/v1', middleware: ['auth'] }, () => {
  route.get('/projects', 'Actions/Project/IndexAction')
  route.post('/projects', 'Actions/Project/StoreAction')

  route.get('/projects/{project}', 'Actions/Project/ShowAction')
    .middleware('throttle:60,1')
})`,
      },
      commands: [
        'buddy make:action Project/IndexAction',
        'buddy generate:openapi',
        'buddy test --feature',
      ],
      docs: '/docs',
      related: ['mobile-and-desktop', 'documentation', 'background-jobs'],
    },
  },

  {
    slug: 'realtime',
    title: 'Realtime apps',
    blurb: 'WebSocket channels, presence, and live dashboards.',
    icon: 'i-hugeicons-satellite-02',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'The row changed, so the screen changed.',
      lede: 'Chat, collaboration, live dashboards, and order tracking all reduce to the same problem: something happened on the server and a browser needs to know now. Model events, broadcast channels, and STX signals connect those two ends without a second realtime service in the middle.',
      challenges: [
        { title: 'Two sources of truth', text: 'A separate realtime provider means the socket payload and the database row are maintained by different code.' },
        { title: 'Authorisation over sockets', text: 'Channel access needs the same rules as the HTTP request, or it becomes the way around them.' },
        { title: 'Presence is stateful', text: 'Who is online, in which room, on how many tabs, and what happens when the process restarts.' },
        { title: 'Reconnects lose messages', text: 'A dropped socket without replay shows a user a stale screen that looks live.' },
      ],
      capabilities: [
        { title: 'Channels', text: 'Public, private, and presence channels with authorisation checked through the same gates as routes.' },
        { title: 'Model broadcasts', text: 'The observe trait emits created, updated, and deleted events, which can broadcast without extra plumbing.' },
        { title: 'Client signals', text: 'STX signals bind an incoming message to the DOM without a client framework or a store to configure.' },
        { title: 'Queue-backed fan-out', text: 'Heavy broadcasts go through the queue, so a fan-out to thousands of sockets does not block the request.' },
        { title: 'Local and deployed parity', text: 'The realtime driver runs in buddy dev exactly as it does in production, configured in config/realtime.ts.' },
        { title: 'Fallbacks', text: 'Polling and server-sent events remain available where sockets are blocked, behind the same API.' },
      ],
      stack: ['realtime-and-search', 'application-core', 'queues-and-mail', 'auth'],
      code: {
        file: 'app/Listeners/BroadcastOrder.ts',
        code: `import { broadcast } from '@stacksjs/realtime'

export default async function (order) {
  await broadcast
    .private('team.' + order.team_id)
    .emit('order:updated', {
      id: order.id,
      status: order.status,
    })
}`,
      },
      commands: [
        'buddy make:action BroadcastOrder',
        'buddy dev',
        'buddy queue:work',
      ],
      docs: '/docs',
      related: ['internal-tools', 'apis', 'mobile-and-desktop'],
    },
  },

  {
    slug: 'background-jobs',
    title: 'Background workloads',
    blurb: 'Queues, batches, schedules, retries, and workers.',
    icon: 'i-hugeicons-time-schedule',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'Everything slow belongs off the request, and it is one line to put it there.',
      lede: 'Imports, exports, mail, image processing, webhooks, nightly rollups, and third-party syncs are the work that decides whether an app feels fast. Jobs are files in app/Jobs/, dispatched from anywhere, retried on their own terms, and visible in the dashboard while they run.',
      challenges: [
        { title: 'Retries need intent', text: 'Blind retries turn one failing webhook into a thousand duplicate charges.' },
        { title: 'Scheduling is infrastructure', text: 'A crontab on one box is a single point of failure nobody has documented.' },
        { title: 'Failures go quiet', text: 'A queue without visibility is a place where work disappears and nobody is paged.' },
        { title: 'Local parity', text: 'If jobs only run in production, they are only debugged in production.' },
      ],
      capabilities: [
        { title: 'Jobs as files', text: 'app/Jobs/ holds one class per unit of work, with queue, tries, backoff, timeout, and rate declared on it.' },
        { title: 'Dispatch anywhere', text: 'dispatch, dispatchIf, dispatchAfter, and dispatchNow from an action, a listener, a command, or another job.' },
        { title: 'Batches and chains', text: 'Group work, track progress, and run a completion callback when the last member finishes.' },
        { title: 'Scheduling in code', text: 'app/Scheduler.ts declares recurring work in TypeScript, so the schedule is reviewed like any other change.' },
        { title: 'Drivers', text: 'Database, Redis, and SQS behind one API, chosen in config/queue.ts and swappable per environment.' },
        { title: 'Visible failures', text: 'The dashboard shows pending, running, and failed jobs, with retry and payload inspection.' },
      ],
      stack: ['queues-and-mail', 'application-core', 'cloud-deploys', 'testing'],
      code: {
        file: 'app/Jobs/SyncInventory.ts',
        code: `export default {
  name: 'SyncInventory',
  queue: 'integrations',
  tries: 5,
  backoff: [10, 60, 300],
  timeout: 120,

  async handle({ supplierId }) {
    const rows = await supplier.fetch(supplierId)

    await Product.upsertMany(rows)
  },
}`,
      },
      commands: [
        'buddy make:job SyncInventory',
        'buddy queue:work --queue=integrations',
        'buddy queue:failed',
      ],
      docs: '/docs',
      related: ['apis', 'realtime', 'enterprise'],
    },
  },

  {
    slug: 'ai-apps',
    title: 'AI applications',
    blurb: 'Anthropic, OpenAI, Bedrock, and Ollama, with RAG and embeddings.',
    icon: 'i-hugeicons-ai-chat-02',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'The model call is the easy part. The rest is an application.',
      lede: 'An AI feature is a queue, a vector index, a cache, a rate limit, a cost ledger, and a place to put the transcript. Stacks gives you all of those already wired to your models, so the interesting work is the prompt and the product rather than the plumbing around them.',
      challenges: [
        { title: 'Latency belongs in a job', text: 'Model calls are slow and flaky, which makes them the worst thing to do inside a request.' },
        { title: 'Retrieval needs your data', text: 'RAG is only as good as the pipeline that keeps embeddings current with the rows they describe.' },
        { title: 'Cost is invisible until it is not', text: 'Tokens, retries, and runaway loops need metering and limits from the first release.' },
        { title: 'Providers change', text: 'Being locked to one vendor SDK makes evaluating a cheaper or better model a rewrite.' },
      ],
      capabilities: [
        { title: 'One driver interface', text: 'Anthropic, OpenAI, and Ollama share one chat API, chosen in config/ai.ts, with Bedrock alongside as its own driver for AWS-hosted models.' },
        { title: 'Embeddings and RAG', text: 'Generate embeddings from model changes and query an in-memory vector index for retrieval, using the same events as everything else.' },
        { title: 'Queued generation', text: 'Long calls run as jobs with retries and timeouts, and results stream back over realtime channels.' },
        { title: 'MCP client', text: 'Talk to Model Context Protocol servers from the application, so tools and data sources are configuration.' },
        { title: 'Caching and limits', text: 'Cache-aside for repeated prompts, rate limits per user or team, and usage recorded like any other model.' },
        { title: 'Vision and images', text: 'Image analysis runs on Claude or GPT and image generation runs through DALL-E, both part of the same package rather than a second integration.' },
      ],
      stack: ['ai', 'queues-and-mail', 'realtime-and-search', 'application-core'],
      code: {
        file: 'app/Jobs/SummariseTicket.ts',
        code: `import { ai } from '@stacksjs/ai'

export default {
  name: 'SummariseTicket',
  queue: 'ai',
  tries: 3,

  async handle({ ticketId }) {
    const ticket = await Ticket.find(ticketId)

    ticket.summary = await ai.summarize(ticket.body)

    await ticket.save()
  },
}`,
      },
      commands: [
        'buddy make:job SummariseTicket',
        'buddy queue:work --queue=ai',
        'buddy dev',
      ],
      docs: '/docs',
      related: ['background-jobs', 'apis', 'internal-tools'],
    },
  },

  {
    slug: 'internal-tools',
    title: 'Internal tools and admin',
    blurb: 'Dashboards and back offices generated from your models.',
    icon: 'i-hugeicons-dashboard-square-01',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'The admin panel reads your models, so it exists before you build it.',
      lede: 'Internal tools are the software a company runs on and the software nobody is given time to build. The Stacks dashboard ships with model views, search, role-aware access, queue and deployment monitoring, and 150 or so components, so an operations screen is a page rather than a project.',
      challenges: [
        { title: 'Nobody funds the back office', text: 'Support, finance, and operations end up in the database console because the admin never gets prioritised.' },
        { title: 'Access has to be real', text: 'An internal tool is a full-privilege surface, so roles, gates, and an audit trail are mandatory, not nice to have.' },
        { title: 'Third-party admin tools drift', text: 'A hosted table editor sees rows, not domain rules, so it happily writes states your application forbids.' },
        { title: 'Every team wants a different screen', text: 'The tool is never finished, so the cost of adding a view is what matters.' },
      ],
      capabilities: [
        { title: 'Model views', text: 'List, filter, create, edit, and delete screens generated from model definitions, overridable per model.' },
        { title: 'Component library', text: 'Tables, forms, charts, kanban boards, toasts, and 150+ components already themed.' },
        { title: 'Role-aware', text: 'The same RBAC and gates as the app decide who sees which screen and which action.' },
        { title: 'Operations built in', text: 'Queues, failed jobs, deployments, captured mail, and logs are dashboard pages rather than SSH sessions.' },
        { title: 'Domain rules respected', text: 'Writes go through your actions and validation, so an admin edit cannot produce a state your app rejects.' },
        { title: 'Global search', text: 'One search box across models, so support can find a record without knowing which table it is in.' },
      ],
      stack: ['dashboard', 'auth', 'application-core', 'queues-and-mail'],
      code: {
        file: 'config/dashboard.ts',
        code: `export default {
  path: '/admin',

  models: ['User', 'Team', 'Order', 'Subscription'],

  widgets: ['revenue', 'signups', 'queue-health'],

  auth: { middleware: ['auth', 'role:admin'] },
}`,
      },
      commands: [
        'buddy dev dashboard',
        'buddy make:model Ticket',
        'buddy migrate',
      ],
      docs: '/docs',
      related: ['saas', 'ecommerce', 'enterprise'],
    },
  },

  {
    slug: 'multi-tenant-platforms',
    title: 'Multi-tenant platforms',
    blurb: 'One deploy serving many customers, domains, and mail senders.',
    icon: 'i-hugeicons-building-03',
    group: 'workloads',
    page: {
      kicker: 'Workloads',
      headline: 'Many customers, one application, no copy-paste deploys.',
      lede: 'Tenancy is a decision that touches routing, queries, storage, mail, and DNS. Stacks has the pieces in the box: team ownership on the models, gates that scope every read, per-site configuration, and cloud config that can put a customer on their own hostname with its own certificate.',
      challenges: [
        { title: 'Scoping must be the default', text: 'One query that forgets its tenant column is a data leak, and it will not throw.' },
        { title: 'Custom domains are infrastructure', text: 'Each customer hostname needs DNS, a certificate, and routing that maps it back to a tenant.' },
        { title: 'Noisy neighbours', text: 'One tenant importing a million rows should not slow down everyone else on the queue.' },
        { title: 'Per-tenant everything', text: 'Branding, mail sender, storage prefix, and feature flags all vary, and each is somewhere different in a naive design.' },
      ],
      capabilities: [
        { title: 'Ownership on the model', text: 'Teams and roles ship first-party, so a tenant column and its relationships are a trait rather than a convention.' },
        { title: 'Scoped queries', text: 'Gates and query scopes apply the tenant filter centrally, so an action cannot forget it.' },
        { title: 'Hostname routing', text: 'config/sites.ts and the router map a domain to a tenant, and config/cloud.ts publishes the DNS and TLS for it.' },
        { title: 'Queue isolation', text: 'Per-tenant queues and rate limits keep one heavy customer from starving the rest.' },
        { title: 'Per-tenant mail', text: 'Sender identity, SPF, DKIM, and DMARC records per domain, published with the rest of the infrastructure.' },
        { title: 'Storage prefixes', text: 'Uploads land under a tenant prefix locally and on S3 through the same storage API.' },
      ],
      stack: ['auth', 'cloud-deploys', 'storage', 'queues-and-mail'],
      code: {
        file: 'app/Middleware/ResolveTenant.ts',
        code: `import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'ResolveTenant',

  async handle(request) {
    const host = request.header('host')

    request.tenant = await Team.where('domain', host).first()
  },
})`,
      },
      commands: [
        'buddy make middleware ResolveTenant',
        'buddy domains:add customer.example',
        'buddy deploy',
      ],
      docs: '/docs',
      related: ['saas', 'marketplaces', 'enterprise'],
    },
  },

  {
    slug: 'startups',
    title: 'Startups',
    blurb: 'Ship in days, and still be able to change it in year two.',
    icon: 'i-hugeicons-bulb',
    group: 'teams',
    page: {
      kicker: 'Teams',
      headline: 'Fast at the start is easy. Fast in month nine is the point.',
      lede: 'A young company pays twice for its stack: once when assembling it and again every time it needs to change. Stacks trades a wide choice of libraries for one typed application where a rename is a compile error and the infrastructure is a file in the repository.',
      challenges: [
        { title: 'Assembly is not product', text: 'The first fortnight goes on auth, mail, queues, deploys, and CI rather than on anything a customer sees.' },
        { title: 'Pivots hit the schema', text: 'The model you launch with is not the model you keep, and refactors are where untyped stacks charge interest.' },
        { title: 'One person owns ops', text: 'Small teams cannot afford a stack whose deploy story needs a specialist.' },
        { title: 'Hiring against a snowflake', text: 'A bespoke assembly of ten libraries has no onboarding path and no documentation.' },
      ],
      capabilities: [
        { title: 'Day one is day one', text: 'buddy new gives you auth, models, queue, mail, dashboard, tests, and a deploy pipeline in one install.' },
        { title: 'Refactors that are safe', text: 'Route, action, model, and view are typed against each other, so the compiler finds callers a grep would miss.' },
        { title: 'Deploys in a command', text: 'buddy deploy provisions and ships, and the shipped CI workflow does it on every green push to main.' },
        { title: 'Conventions to hire into', text: 'Files land where the framework says, so a new engineer reads the same layout every Stacks app has.' },
        { title: 'Cost control', text: 'Server or serverless is a config choice, and SQLite is a legitimate production database until it is not.' },
        { title: 'Tests from the start', text: 'Database test utilities and feature tests ship with the project, so coverage is not a later initiative.' },
        { title: 'Real companies run on it', text: 'BugHQ (bughq.org), StatusHQ (statushq.org), AnalyticsHQ (analyticshq.org), and LogHQ (loghq.org) are production Stacks applications today, and all four are open source. CommsHQ, a marketing and communications platform, is built the same way and ships as either a self-hosted install or a paid subscription.' },
      ],
      stack: ['application-core', 'auth', 'testing', 'cloud-deploys'],
      code: {
        file: 'terminal',
        code: `bun create stacks my-app

cd my-app
buddy migrate --auth
buddy dev

// then, when it is time
buddy deploy`,
      },
      commands: [
        'bun create stacks my-app',
        'buddy dev',
        'buddy deploy',
      ],
      docs: '/docs',
      related: ['saas', 'solo-developers', 'internal-tools'],
    },
  },

  {
    slug: 'agencies',
    title: 'Agencies and studios',
    blurb: 'One stack on every client project, and a clean handover.',
    icon: 'i-hugeicons-briefcase-01',
    group: 'teams',
    page: {
      kicker: 'Teams',
      headline: 'One stack across every client, and a handover that stands on its own.',
      lede: 'Agency work punishes variety: each project with its own assembly of libraries is a maintenance contract nobody priced. A framework with conventions means the fifth project starts where the fourth finished, and the client inherits something documented rather than something bespoke.',
      challenges: [
        { title: 'Every project is a new stack', text: 'Different bundlers, ORMs, and hosting per client means no shared muscle memory and no reusable work.' },
        { title: 'Handover is a cliff', text: 'A codebase only its authors understand becomes an open-ended support obligation.' },
        { title: 'Scope grows sideways', text: 'The brochure site needs a shop, then a portal, then an app, and each is a different framework in a typical stack.' },
        { title: 'Margins live in setup', text: 'The hours before the first feature are the least billable and the most repeated.' },
      ],
      capabilities: [
        { title: 'One layout everywhere', text: 'app/, config/, resources/, routes/, and tests/ are the same shape on every project, so context switching is cheap.' },
        { title: 'Marketing to platform', text: 'A site, a store, a CMS, an API, and a dashboard are all the same install, so scope growth is not a re-platform.' },
        { title: 'Reusable work', text: 'Actions, components, and skills carry between projects, and app/Skills/ documents the client-specific parts.' },
        { title: 'Client-owned infrastructure', text: 'config/cloud.ts describes the deploy in the repository, so the client owns their AWS account and the recipe for it.' },
        { title: 'Handover artefacts', text: 'Generated docs, an OpenAPI spec, and tests come out of the project rather than being written for the invoice.' },
        { title: 'Dependency updates', text: 'buddy-bot keeps client projects current on a schedule instead of in an emergency.' },
      ],
      stack: ['application-core', 'cms', 'cloud-deploys', 'testing'],
      code: {
        file: 'config/cloud.ts',
        code: `export default {
  driver: 'aws',

  sites: {
    main: {
      domain: 'client.com',
      subdomains: ['docs', 'api'],
      cdn: true,
      tls: true,
    },
  },
}`,
      },
      commands: [
        'bun create stacks client-project',
        'buddy deploy',
        'buddy upgrade:dependencies',
      ],
      docs: '/docs',
      related: ['marketing-sites', 'content-sites', 'startups'],
    },
  },

  {
    slug: 'enterprise',
    title: 'Enterprise teams',
    blurb: 'Typed boundaries, auditability, RBAC, and reviewable infrastructure.',
    icon: 'i-hugeicons-building-06',
    group: 'teams',
    page: {
      kicker: 'Teams',
      headline: 'Every layer is reviewable, and every change is typed.',
      lede: 'Large organisations do not need the fastest way to start; they need to know what is running, who may do what, and how a change reaches production. Stacks keeps the schema, the access rules, the schedule, and the infrastructure in TypeScript files that go through the same review as application code.',
      challenges: [
        { title: 'Reviewing what actually runs', text: 'Infrastructure edited in a console leaves no diff, and no way to know when it changed.' },
        { title: 'Access rules spread out', text: 'Permissions checked ad hoc in controllers and templates cannot be audited as a whole.' },
        { title: 'Long-lived migrations', text: 'A decade of schema history has to stay reproducible, on more than one database engine.' },
        { title: 'Onboarding at scale', text: 'A stack assembled from twenty libraries costs weeks of ramp per engineer.' },
      ],
      capabilities: [
        { title: 'Infrastructure in the repo', text: 'config/cloud.ts describes sites, DNS, certificates, CDN, and mail records, so a change to production is a pull request.' },
        { title: 'Centralised authorisation', text: 'RBAC, gates in app/Gates.ts, and policies give one place to read what each role may do.' },
        { title: 'Model-driven migrations', text: 'Schema is diffed from models into reviewable SQL, against SQLite, MySQL, or PostgreSQL.' },
        { title: 'Auditability', text: 'Model events, logging, and queue history record what happened without bolting on an audit library.' },
        { title: 'Typed end to end', text: 'Views, routes, actions, models, and the API client share types, so contract changes fail at build time.' },
        { title: 'Encrypted configuration', text: 'buddy env:encrypt keeps environment values in the repository safely, with rotation as a command.' },
      ],
      stack: ['auth', 'cloud-deploys', 'testing', 'application-core'],
      code: {
        file: 'app/Gates.ts',
        code: `import { gate } from '@stacksjs/auth'

gate.define('order.refund', (user, order) => {
  return user.hasRole('finance')
    && order.team_id === user.team_id
})

gate.define('report.export', user => user.hasRole('analyst'))`,
      },
      commands: [
        'buddy env:encrypt',
        'buddy migrate --diff',
        'buddy test',
      ],
      docs: '/docs',
      related: ['multi-tenant-platforms', 'internal-tools', 'background-jobs'],
    },
  },

  {
    slug: 'solo-developers',
    title: 'Solo developers',
    blurb: 'One person, one stack, and no glue code to maintain.',
    icon: 'i-hugeicons-user-group',
    group: 'teams',
    page: {
      kicker: 'Teams',
      headline: 'The whole stack fits in one head.',
      lede: 'Building alone means every integration is yours forever. A framework that ships the database layer, the queue, the mail, the admin, and the deploy removes the part of side-project work that is not the project, and keeps the surface small enough to hold in memory.',
      challenges: [
        { title: 'Glue is where projects die', text: 'The evening spent making an ORM, a queue, and a mail library agree is the evening the idea loses momentum.' },
        { title: 'Context is expensive', text: 'Coming back after three weeks away should not mean relearning your own wiring.' },
        { title: 'Hosting costs attention', text: 'A stack that needs four managed services costs money and vigilance you do not have.' },
        { title: 'No one to review you', text: 'Types and tests are the code review a solo developer actually gets.' },
      ],
      capabilities: [
        { title: 'One install', text: 'Auth, models, queue, mail, storage, search, dashboard, and deploys arrive together and are already wired.' },
        { title: 'SQLite that scales further than you think', text: 'A single file in development and, for many projects, in production too, with Postgres or MySQL a config change away.' },
        { title: 'Scaffolding', text: 'buddy make:* writes the file, the test, and the registration, so starting a feature is one command.' },
        { title: 'One process in development', text: 'buddy dev runs the site, the API, the docs, and the reverse proxy with SSL together.' },
        { title: 'Deploy without a platform team', text: 'buddy deploy handles the build, the infrastructure, DNS, and certificates.' },
        { title: 'Types as a safety net', text: 'The compiler catches what a second pair of eyes would have, which matters most when there is no second pair.' },
      ],
      stack: ['application-core', 'testing', 'cloud-deploys', 'storage'],
      code: {
        file: 'app/Actions/CreateNote.ts',
        code: `import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateNote',

  handle: async (request) => {
    return await Note.create({
      title: request.get('title'),
      body: request.get('body'),
    })
  },
})`,
      },
      commands: [
        'buddy make:action CreateNote',
        'buddy dev',
        'buddy deploy',
      ],
      docs: '/docs',
      related: ['startups', 'marketing-sites', 'open-source-libraries'],
    },
  },

  {
    slug: 'open-source-libraries',
    title: 'Open-source libraries',
    blurb: 'Build, type, document, test, and publish framework-agnostic packages.',
    icon: 'i-hugeicons-package',
    group: 'teams',
    page: {
      kicker: 'Teams',
      headline: 'Ship a library with the same tooling you ship an app with.',
      lede: 'Stacks began as library tooling, and that half is still first-party: build a package with Bun, emit declarations, run the tests, write the docs site, and publish, without assembling a release pipeline for every new repository.',
      challenges: [
        { title: 'Every library rebuilds its pipeline', text: 'Bundler, declaration emit, linting, changelog, and release workflow get copied between repositories and drift apart.' },
        { title: 'Types are the product', text: 'A published package whose declarations are wrong is worse than one with no types at all.' },
        { title: 'Docs decide adoption', text: 'A library without a documentation site is a library people evaluate by reading source.' },
        { title: 'Releases are error-prone by hand', text: 'Version, changelog, tag, publish, and announce is a checklist that eventually gets skipped.' },
      ],
      capabilities: [
        { title: 'Library builds', text: 'buddy build handles bundling and declaration emit for framework-agnostic packages, not just applications.' },
        { title: 'One linter', text: 'pickier formats and lints the whole repository, and buddy lint:fix is the same command in every project.' },
        { title: 'Docs included', text: 'The docs build turns markdown into a themed site with search, deployable beside the package.' },
        { title: 'Tests with Bun', text: 'buddy test runs unit and feature suites, and buddy typecheck runs the native TypeScript compiler in seconds.' },
        { title: 'Commit and changelog conventions', text: 'Conventional commits, git hooks, and generated changelogs come from config, not from a copied script.' },
        { title: 'Dependency hygiene', text: 'buddy-bot proposes updates on a schedule, so a quiet library does not silently rot.' },
      ],
      stack: ['testing', 'application-core', 'cloud-deploys'],
      code: {
        file: 'package.json',
        code: `{
  "name": "my-library",
  "type": "module",
  "exports": { ".": "./dist/index.js" },
  "types": "./dist/index.d.ts",

  "scripts": {
    "build": "buddy build",
    "test": "buddy test",
    "lint": "buddy lint"
  }
}`,
      },
      commands: [
        'buddy build',
        'buddy test',
        'buddy lint:fix',
      ],
      docs: '/docs',
      related: ['documentation', 'solo-developers', 'agencies'],
    },
  },
]

export function useCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find(useCase => useCase.slug === slug)
}

export function useCasesInGroup(group: string): UseCase[] {
  return useCases.filter(useCase => useCase.group === group)
}
