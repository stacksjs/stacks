/**
 * The platform features, in one place.
 *
 * Three surfaces render this list: the bento grid on the home page, the
 * Features mega menu in the nav, and the /features pages. They used to be
 * three separate hardcoded lists, which is how a nav ends up offering a
 * section the page below it no longer has.
 *
 * `group` drives the mega-menu columns. `blurb` is the one-line version the
 * menu and the bento show; everything under `page` only the feature page
 * reads, so adding a feature costs one entry here and no new file.
 */

export interface FeatureCapability {
  title: string
  text: string
}

export interface FeatureCode {
  /** Shown in the window title bar, so it should be a path a reader recognises. */
  file: string
  code: string
}

export interface Feature {
  slug: string
  title: string
  /** One line. The mega menu and the bento cell both show this. */
  blurb: string
  icon: string
  group: 'build' | 'run' | 'ship'
  /**
   * Placement in the home-page bento. `cols` is the cell's width out of 12 at
   * desktop, and the list order is the grid order, so every run of cells has
   * to sum to 12 or the row leaves a hole (a test checks it). `visual` swaps
   * the cell's plain body for a richer one built from real data: the
   * feature's own code sample, its capability titles, its build targets, its
   * AI providers, its content types, or its deploy steps.
   */
  bento: {
    cols: 3 | 4 | 5 | 6 | 7 | 8
    visual?: 'code' | 'capabilities' | 'targets' | 'providers' | 'deploy' | 'content'
    tone?: 'tint' | 'gradient'
  }
  page: {
    kicker: string
    headline: string
    lede: string
    capabilities: FeatureCapability[]
    code: FeatureCode
    /** Buddy commands that do this feature's work, shown as a shell strip. */
    commands: string[]
    docs: string
    /** Slugs. Rendered as "pairs with" cards at the foot of the page. */
    related: string[]
  }
}

export const featureGroups = [
  { id: 'build', title: 'Build', text: 'The application itself: what it serves and who may see it.' },
  { id: 'run', title: 'Run', text: 'The work that happens around a request rather than inside it.' },
  { id: 'ship', title: 'Ship', text: 'Proving it works, then putting it somewhere.' },
] as const

export const features: Feature[] = [
  {
    slug: 'application-core',
    title: 'Application core',
    blurb: 'Routing, STX views, models, actions, middleware, and validation in one typed application.',
    icon: 'i-hugeicons-layers-01',
    group: 'build',
    bento: { cols: 7, visual: 'code' },
    page: {
      kicker: 'Build',
      headline: 'One typed application, not six libraries you glued together.',
      lede: 'A route, the action behind it, the model under that, and the view it renders are all first-party and all typed against each other. Rename a model attribute and the compiler finds every caller, because there is no boundary where the types stop.',
      capabilities: [
        { title: 'Routing', text: 'Verb helpers, groups, prefixes, named routes, and route model binding. Routes live in routes/ and register through app/Routes.ts.' },
        { title: 'Actions', text: 'A route points at an action rather than a controller method. Actions are single-purpose files in app/Actions/, and models with the useApi trait generate their own.' },
        { title: 'Models', text: 'defineModel() declares schema, validation, factories, relationships, and traits in one file. Migrations are diffed out of it, not hand-written.' },
        { title: 'STX views', text: 'Single-file components with a server/client script split, Blade-style directives, and signals for reactivity. No build config to own.' },
        { title: 'Middleware', text: 'Request middleware in app/Middleware/, registered in app/Middleware.ts, applied per route or per group.' },
        { title: 'Validation', text: 'Attribute rules live on the model, so the same schema validates the request, the factory, and the generated API.' },
        { title: 'Typed API client', text: 'Register routes with createTypedRouter() and createTypedClient() infers every path, body, and response from the actions themselves. No generation step, nothing committed to go stale.' },
        { title: 'OpenAPI', text: 'buddy generate:openapi-spec writes the spec for consumers outside TypeScript, from the same routes and validations.' },
        { title: 'Privacy by model', text: 'Mark an attribute personal and buddy gdpr:export, gdpr:erase, and gdpr:prune answer data-subject requests and retention rules, with a processing register beside them.' },
      ],
      code: {
        file: 'app/Models/Post.ts',
        code: `import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Post',
  table: 'posts',

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: { uri: 'posts', routes: ['index', 'show'] },
  },

  belongsTo: ['Author'],

  attributes: {
    title: {
      fillable: true,
      required: true,
      validation: { rule: schema.string().max(160) },
      factory: faker => faker.lorem.sentence(),
    },
  },
})`,
      },
      commands: [
        'buddy make:model Post',
        'buddy generate:migrations',
        'buddy migrate',
      ],
      docs: '/docs',
      related: ['cms', 'auth', 'testing'],
    },
  },

  {
    slug: 'queues-and-mail',
    title: 'Queues and mail',
    blurb: 'Jobs, batches, schedules, events, notifications, and worker-ready background workflows.',
    icon: 'i-hugeicons-mail-send-01',
    group: 'run',
    bento: { cols: 5, visual: 'capabilities' },
    page: {
      kicker: 'Run',
      headline: 'Work that outlives the request that started it.',
      lede: 'Queues, schedules, events, and mail are one subsystem here rather than four packages with four config formats. A job dispatched in a request and a job fired by the scheduler are the same class, run by the same worker, against the same driver. Mail can mean sending through SES or Mailgun, or it can mean running the mailbox itself: a self-hostable SMTP and IMAP server for real inboxes on your own domain.',
      capabilities: [
        { title: 'Jobs and queues', text: 'Classes in app/Jobs/ dispatched from anywhere, run by a worker, with retries, backoff, and batches. Drivers cover sync, database, and Redis.' },
        { title: 'Scheduling', text: 'app/Scheduler.ts declares recurring work in TypeScript instead of a crontab, so it ships and reviews with the code.' },
        { title: 'Events and listeners', text: 'app/Events.ts maps events to listeners in app/Listeners/. Models with the observe trait emit created, updated, and deleted for free.' },
        { title: 'Mail', text: 'Mail classes in app/Mail/ render STX templates and send through SES, SendGrid, Mailgun, or plain SMTP behind one interface.' },
        { title: 'Your own mail server', text: 'A self-hostable SMTP and IMAP mail server for real mailboxes on your own domain, opt-in and deployed alongside the app, for teams that would rather not pay for Google Workspace or Fastmail just to receive mail.' },
        { title: 'Notifications', text: 'One notification, several channels: email, SMS, push, chat, or a database row the dashboard can read.' },
        { title: 'Batches', text: 'Group jobs, track progress as a unit, and hang a completion callback off the batch rather than off the last job.' },
        { title: 'When jobs fail', text: 'A dead-letter queue, poison-job quarantine, a circuit breaker per dependency, and idempotency keys, all driven from buddy queue:dlq, queue:quarantine, and queue:pause.' },
        { title: 'Deliverability', text: 'Suppression lists, one-click unsubscribe, signed provider webhooks for bounces and complaints, inbound parsing, and a captured-mail inbox in development.' },
      ],
      code: {
        file: 'app/Jobs/SendWelcomeEmail.ts',
        code: `import { mail, template } from '@stacksjs/email'
import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'SendWelcomeEmail',
  tries: 3,
  backoff: 30,

  async handle({ userId }: { userId: number }) {
    const user = await User.find(userId)
    if (!user)
      return

    const { html, text } = await template('welcome', {
      variables: { name: user.name },
    })

    await mail.send({
      to: user.email,
      subject: 'Welcome to the stack',
      html,
      text,
    })
  },
})`,
      },
      commands: [
        'buddy make:job SendWelcomeEmail',
        'buddy queue:work',
        'buddy make:notification OrderShipped',
      ],
      docs: '/docs',
      related: ['realtime-and-search', 'application-core', 'cloud-deploys'],
    },
  },

  {
    slug: 'native-apps',
    title: 'Native apps',
    blurb: 'The same STX UI ships as a web app, an iOS or Android app, and a desktop app with a system tray, from one codebase.',
    icon: 'i-hugeicons-smart-phone-01',
    group: 'ship',
    bento: { cols: 8, visual: 'targets' },
    page: {
      kicker: 'Ship',
      headline: 'One UI. Web, desktop, and mobile.',
      lede: 'The views, components, routes, and API already written for the web are the application. Craft, the native runtime Stacks builds on, wraps that same STX UI in a desktop window with a system tray, or a native iOS and Android shell, so a feature built once ships to every device without a second codebase to keep in sync.',
      capabilities: [
        { title: 'Desktop', text: 'buddy dev:desktop opens the dashboard or app in a native Craft window; buddy build:desktop compiles a launcher with the runtime pinned and checksummed alongside it.' },
        { title: 'System tray', text: 'Tray-only builds ship from the same views, for a menu-bar utility instead of a full window.' },
        { title: 'iOS and Android', text: 'buddy build:ios and buddy build:android generate the native Xcode and Gradle projects from config/mobile.ts and the app’s existing STX views.' },
        { title: 'Native capabilities', text: 'Safe areas, haptics, and native sharing are STX composables, called the same way from a component that also renders on the web.' },
        { title: 'One config, many targets', text: 'App name, bundle ID, icons, and permissions live in config/mobile.ts, read by every native build.' },
        { title: 'Store delivery', text: 'Builds are provenance-stamped and ready for the App Store, Google Play, or the Mac App Store.' },
      ],
      code: {
        file: 'config/mobile.ts',
        code: `import type { MobileConfig } from '@stacksjs/types'

export default {
  ios: {
    appName: 'My App',
    bundleId: 'com.example.app',
  },
  android: {
    appName: 'My App',
    packageName: 'com.example.app',
  },
} satisfies MobileConfig`,
      },
      commands: [
        'buddy dev:desktop',
        'buddy build:ios',
        'buddy build:android',
      ],
      docs: '/docs',
      related: ['application-core', 'dashboard', 'cloud-deploys'],
    },
  },

  {
    slug: 'cms',
    title: 'CMS',
    blurb: 'Posts, pages, taxonomy, media, a real dashboard, and generated content APIs.',
    icon: 'i-hugeicons-note-edit',
    group: 'build',
    bento: { cols: 4, visual: 'content', tone: 'tint' },
    page: {
      kicker: 'Build',
      headline: 'Content your editors will actually use, in the same repo.',
      lede: 'Posts, pages, categories, tags, comments, and media are models like any other, which means they get the dashboard, the generated API, and the migrations without a second system to host, patch, and keep in sync with the site.',
      capabilities: [
        { title: 'Posts and pages', text: 'Markdown body, excerpt, author, publish state, and stable slugs. Both are editable in the dashboard and readable over the API.' },
        { title: 'Taxonomy', text: 'Categories and tags through the categorizable and taggable traits, with the pivot tables migrated for you.' },
        { title: 'Comments', text: 'The commentable trait adds threads, moderation state, and the relations to any model, not just posts.' },
        { title: 'Media', text: 'Images, attachments, and assets go through the same storage drivers the rest of the app uses.' },
        { title: 'Feeds', text: 'RSS and a sitemap are generated from the content that exists, so they cannot drift from it.' },
        { title: 'Docs and blog', text: 'BunPress docs at /docs and a Markdown blog at /blog build and deploy with the site, from one command.' },
      ],
      code: {
        file: 'app/Models/Article.ts',
        code: `import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Article',
  table: 'articles',

  traits: {
    useTimestamps: true,
    useSeeder: { count: 20 },
    useSearch: { searchable: ['title'] },
    taggable: true,
    categorizable: true,
    commentable: true,
    useApi: { uri: 'articles', routes: ['index', 'show'] },
  },

  attributes: {
    title: { fillable: true, required: true },
    status: {
      fillable: true,
      default: 'draft',
      validation: {
        rule: schema.enum(['draft', 'published']),
      },
    },
  },
})`,
      },
      commands: [
        'buddy make:model Article',
        'buddy generate:migrations',
        'buddy dev docs',
      ],
      docs: '/docs',
      related: ['application-core', 'storage', 'realtime-and-search'],
    },
  },

  {
    slug: 'auth',
    title: 'Auth',
    blurb: 'Sessions, tokens, passkeys, social login, magic links, policies, guards, and rate limiting.',
    icon: 'i-hugeicons-shield-key',
    group: 'build',
    bento: { cols: 4 },
    page: {
      kicker: 'Build',
      headline: 'Who is asking, and may they.',
      lede: 'Authentication and authorization are one subsystem, not an auth package next to a permissions package that disagree about what a user is. Turn on the useAuth trait and the columns, the passkey tables, the social providers, and the guards arrive together, whether a user signs in with a password, a passkey, a social account, or a magic link.',
      capabilities: [
        { title: 'Sessions and tokens', text: 'Cookie sessions for the browser and API tokens for everything else, both resolving to the same authenticated user.' },
        { title: 'Social login', text: 'Apple, GitHub, Google, Facebook, and X sign-in over OAuth2, with PKCE where the provider requires it and account linking so a social login and a password resolve to the same user.' },
        { title: 'Magic links', text: 'Passwordless email sign-in with single-use, rate-limited tokens, for the products that would rather not ask for a password at all.' },
        { title: 'Passkeys', text: 'WebAuthn registration and assertion, with the credential tables added by the useAuth trait rather than by hand.' },
        { title: 'Two-factor', text: 'TOTP enrolment, verification, and recovery codes, on the same model as the password.' },
        { title: 'Gates and policies', text: 'app/Gates.ts holds the checks; policies put per-model rules next to the model they guard.' },
        { title: 'Roles and permissions', text: 'RBAC with roles, permissions, and the relations already migrated.' },
        { title: 'Request protection', text: 'CSRF tokens on every state-mutating route by default, plus per-route and per-identity rate limits and account lockout after repeated failed logins.' },
        { title: 'OAuth 2 server', text: 'Be the identity provider, not just a client: authorization codes with PKCE, consent, client registration, token exchange, introspection, and revocation, for "Sign in with" your app or for guarding an MCP server.' },
      ],
      code: {
        file: 'app/Gates.ts',
        code: `import type { UserModel } from '@stacksjs/orm'
import { defineGates, Rbac } from '@stacksjs/auth'

type User = UserModel | null
type PostRow = { author_id: number }

// A gate answers one question and is callable from
// routes, actions, and views, so the rule lives in
// one place rather than three.
export default defineGates({
  gates: {
    'update-post': async (user: User, post: PostRow) => {
      if (!user)
        return false
      return user.id === post.author_id
        || await Rbac.hasRole(user, 'editor')
    },

    'access-dashboard': async (user: User) => user !== null
      && await Rbac.hasPermission(user, 'dashboard:view'),
  },
})`,
      },
      commands: [
        'buddy auth:setup',
        'buddy make:policy PostPolicy',
        'buddy make:middleware EnsureVerified',
      ],
      docs: '/docs',
      related: ['application-core', 'testing', 'cms'],
    },
  },

  {
    slug: 'commerce',
    title: 'Commerce',
    blurb: 'Products, orders, customers, coupons, payments, shipping, tax, and gift cards, as models you already know how to query.',
    icon: 'i-hugeicons-shopping-bag-02',
    group: 'build',
    bento: { cols: 4 },
    page: {
      kicker: 'Build',
      headline: 'A store is not a second application.',
      lede: 'Products, orders, customers, coupons, gift cards, shipping, and tax are 35-plus models in the same ORM as everything else, with the dashboard, the generated API, and the migrations that come with any model here. Checkout is a payment driver, not a rewrite.',
      capabilities: [
        { title: 'Catalog', text: 'Products, variants, units, manufacturers, categories, and reviews, related the way a catalog actually nests.' },
        { title: 'Orders and customers', text: 'Order line items, order export, and customer profiles and history, queryable with the same builder as any other model.' },
        { title: 'Payments', text: 'Stripe and Adyen drivers behind checkout, with receipts and refund state tracked alongside the order.' },
        { title: 'Subscriptions and billing', text: 'Make any model billable for Stripe subscriptions, invoices, checkout sessions, and the customer portal; buddy stripe:setup creates the products and prices.' },
        { title: 'Marketplaces', text: 'Stripe Connect accounts, transfers, and payouts, so the platform takes its fee and sellers get paid.' },
        { title: 'Coupons and gift cards', text: 'Discount rules and stored-value cards as first-class models, not a string parsed at checkout.' },
        { title: 'Shipping and tax', text: 'Zones, methods, and rates, plus couriers, delivery routes, and tracking; license keys and digital deliveries for what has nothing to ship; tax rates per region.' },
        { title: 'Waitlists and POS', text: 'Product and restaurant waitlists, plus a point-of-sale view in the dashboard for in-person orders.' },
        { title: 'Auctions', text: 'Lots, proxy bidding, anti-sniping that extends a lot while bids keep coming, pledges, settlement, and bids pushed to every viewer in realtime.' },
        { title: 'Import your store', text: 'buddy commerce:import moves a Shopify, WooCommerce, or Shopware catalog across, and its customers and orders with --customers and --orders. Re-running updates rather than duplicates.' },
      ],
      code: {
        file: 'app/Actions/Commerce/CreateOrderAction.ts',
        code: `import { Action } from '@stacksjs/actions'
import { orders } from '@stacksjs/commerce'
import { paymentDriver } from '@stacksjs/payments'

export default new Action({
  name: 'CreateOrder',
  description: 'Charge a saved card, then record the order',

  async handle(request) {
    const user = await request.user()
    if (!user)
      return { error: 'Sign in to check out' }

    const amount = Number(request.input('total')) // cents
    const charge = await paymentDriver().charge(
      { id: user.id, email: user.email },
      { amount, currency: 'usd' },
      request.input('paymentMethod'),
    )

    return orders.placeOrder({
      order: { status: 'PENDING', total_amount: amount },
      payment: { transaction_id: charge.id, amount },
    })
  },
})`,
      },
      commands: [
        'buddy make:model Product',
        'buddy generate:migrations',
        'buddy dev dashboard',
      ],
      docs: '/docs',
      related: ['dashboard', 'application-core', 'auth'],
    },
  },

  {
    slug: 'dashboard',
    title: 'Dashboard',
    blurb: 'A generated admin panel for every model, plus analytics, operations, kanban, and marketing, in 300-plus components.',
    icon: 'i-hugeicons-dashboard-square-01',
    group: 'build',
    bento: { cols: 4 },
    page: {
      kicker: 'Build',
      headline: 'An admin panel that already knows your models.',
      lede: 'Every model is already a CRUD screen in the dashboard, not a second implementation of the same list, form, and filters. Analytics, job monitoring, and commerce and content management ship as part of the same install.',
      capabilities: [
        { title: 'Model views', text: 'List, create, edit, and delete screens generated from a model’s attributes, so a new field shows up without a hand-built form.' },
        { title: 'Analytics', text: 'Web, page, referrer, device, and browser breakdowns, plus event and blog analytics, from first-party tracking.' },
        { title: 'Jobs and queues', text: 'Watch queue depth, retries, and job history from the same dashboard that runs the app.' },
        { title: 'Commerce and content panels', text: 'Orders, products, customers, posts, and pages get their own dashboard sections without extra setup.' },
        { title: 'Settings', text: 'App, team, and environment settings editable from the UI instead of a config file only a deploy can change.' },
        { title: 'Its own server', text: 'The dashboard runs on its own dev server, so buddy dev dashboard iterates on it without rebuilding the main app.' },
        { title: 'Operations', text: 'Servers, deployments, releases, DNS, logs, errors, slow queries, incidents, recovery, and an audit trail, beside the data they concern.' },
        { title: 'Kanban and marketing', text: 'Boards with cards, labels, and comments, plus campaigns, email lists, social posts, reviews, and abandoned carts.' },
        { title: 'Mail, in and out', text: 'Real mailboxes on your own mail server, and every message the app sent in development, captured and readable.' },
      ],
      code: {
        file: 'app/Models/Product.ts',
        code: `import { defineModel } from '@stacksjs/orm'

// Every model gets a dashboard screen; this sets how
// it shows in the sidebar. useApi adds a REST API.
export default defineModel({
  name: 'Product',
  table: 'products',

  traits: {
    useApi: { uri: 'products' },
  },

  dashboard: {
    icon: 'i-hugeicons-package',
    label: 'Products',
  },

  attributes: {
    name: { fillable: true, required: true },
    price: { fillable: true },
  },
})`,
      },
      commands: [
        'buddy dev dashboard',
        'buddy make:model Product',
      ],
      docs: '/docs',
      related: ['application-core', 'commerce', 'auth'],
    },
  },

  {
    slug: 'storage',
    title: 'Storage',
    blurb: 'Local, S3, signed URLs, uploads, visibility, and file utilities.',
    icon: 'i-hugeicons-folder-cloud',
    group: 'run',
    bento: { cols: 4 },
    page: {
      kicker: 'Run',
      headline: 'The same file API in development and in production.',
      lede: 'A local disk in development and S3 in production are the same interface, so the upload path you tested is the upload path that ships. Swapping the driver is a config change, not a rewrite of every call site.',
      capabilities: [
        { title: 'Drivers', text: 'Local disk, S3 and S3-compatible stores (R2, Backblaze, Filebase, Hetzner, MinIO), and Azure Blob behind one API, chosen per disk in config so an app can use several at once.' },
        { title: 'Uploads', text: 'Validated multipart handling that hands back a stored path, not a temp file you have to remember to move.' },
        { title: 'Signed URLs', text: 'Time-limited URLs for private objects, so a download link can expire without a proxy route in front of it.' },
        { title: 'Visibility', text: 'Public and private per file, enforced by the driver rather than by whichever route happened to serve it.' },
        { title: 'File utilities', text: 'Path helpers, mime detection, streaming reads, and directory listings that behave the same on every driver.' },
        { title: 'CDN', text: 'Production buckets sit behind the CDN that buddy deploy provisions, from the same TypeScript config.' },
      ],
      code: {
        file: 'app/Actions/UploadAvatarAction.ts',
        code: `import { Action } from '@stacksjs/actions'
import { Storage } from '@stacksjs/storage'

export default new Action({
  name: 'UploadAvatar',
  description: 'Store an avatar and hand back a signed URL',
  method: 'POST',

  async handle(request) {
    const file = request.file('avatar')
    if (!file)
      return { error: 'No avatar uploaded' }

    const { path } = await Storage.put(file, {
      disk: 's3',
      dir: 'avatars',
    })

    const url = await Storage.disk('s3')
      .temporaryUrl(path, { expiresIn: 3600 })

    return { url }
  },
})`,
      },
      commands: [
        'buddy make:action UploadAvatar',
        'buddy make:model Attachment',
      ],
      docs: '/docs',
      related: ['cms', 'cloud-deploys', 'application-core'],
    },
  },

  {
    slug: 'ai',
    title: 'AI',
    blurb: 'Anthropic, OpenAI, and Ollama behind one chat driver, Bedrock alongside for AWS-hosted models, plus RAG, embeddings, and MCP.',
    icon: 'i-hugeicons-ai-chat-02',
    group: 'run',
    bento: { cols: 8, visual: 'providers' },
    page: {
      kicker: 'Run',
      headline: 'One driver for chat. The right tool for the rest.',
      lede: 'Chat and streaming are the same call whether the driver is Claude, GPT, or Ollama running locally, so swapping providers is a config change. Vision runs on Claude and GPT, image generation runs through DALL-E, and Bedrock sits alongside as its own driver for teams standardised on AWS-hosted models. RAG, vector search, and an MCP client are the same package, not a separate integration to bolt on.',
      capabilities: [
        { title: 'Chat and streaming', text: 'anthropic.chat(), openai.chat(), ollama.chat(), and their streaming counterparts share a message shape, so a prompt written for one driver runs on the others, including a local model for development or for data that should not leave the box.' },
        { title: 'Vision', text: 'Analyze an uploaded image through the Claude or GPT drivers, using the same message shape as chat.' },
        { title: 'Image generation', text: 'Generate an image from a prompt through the OpenAI driver, using DALL-E.' },
        { title: 'Bedrock', text: 'A separate driver over the Bedrock Converse API (Amazon Nova by default), with fine-tuning jobs and model listing for teams standardised on AWS-hosted models.' },
        { title: 'RAG and embeddings', text: 'Embed content with OpenAI or Ollama, then query an in-memory vector index for retrieval, without a separate vector database to run.' },
        { title: 'MCP client', text: 'Call tools on a Model Context Protocol server from an action or a job, the same way the buddy assistant does.' },
        { title: 'Personalization', text: 'Sentiment, classification, and recommendation helpers over content and event data already in the app.' },
        { title: 'Speech', text: 'Text to speech and speech to text through the OpenAI driver, with the same request shape as chat.' },
        { title: 'Agents', text: 'Run Claude as an agent with tools through the Claude Agent SDK driver, from an action, a job, or the CLI.' },
      ],
      code: {
        file: 'app/Actions/SummarizePostAction.ts',
        code: `import { Action } from '@stacksjs/actions'
import { anthropic } from '@stacksjs/ai'

export default new Action({
  name: 'SummarizePost',
  description: 'Summarize a post with Claude',

  async handle(request) {
    const post = await Post.find(Number(request.input('id')))
    if (!post)
      return { error: 'Post not found' }

    const summary = await anthropic.prompt(
      \`Summarize in two sentences:\\n\\n\${post.content}\`,
    )

    return { summary }
  },
})`,
      },
      commands: [
        'buddy env:set ANTHROPIC_API_KEY sk-ant-...',
        'buddy make:action SummarizePost',
      ],
      docs: '/docs',
      related: ['application-core', 'realtime-and-search', 'queues-and-mail'],
    },
  },

  {
    slug: 'testing',
    title: 'Testing',
    blurb: 'Unit, feature, HTTP, browser, and database tests with factories and helpers.',
    icon: 'i-hugeicons-test-tube-01',
    group: 'ship',
    bento: { cols: 3 },
    page: {
      kicker: 'Ship',
      headline: 'Tests that talk to the real database, and finish anyway.',
      lede: 'Bun runs the suite, so it is fast enough that feature tests hitting a real database stay in the loop you actually run. Factories come from the model you already wrote, which means test data cannot drift from the schema.',
      capabilities: [
        { title: 'Unit and feature', text: 'buddy test splits them, or runs both. Feature tests boot the app and go through the router the way a request does.' },
        { title: 'HTTP assertions', text: 'Call a route, assert on status, headers, and the decoded JSON body without standing up a server yourself.' },
        { title: 'Database helpers', text: 'Per-test migration and truncation, so a test that writes rows does not decide what the next test sees.' },
        { title: 'Factories', text: 'The factory functions on each model attribute generate valid rows, so a schema change breaks the seed rather than the assertion.' },
        { title: 'Component tests', text: 'Drive the DOM in-process with very-happy-dom, so UI behaviour is covered without a browser or a server.' },
        { title: 'Type tests', text: 'buddy typecheck runs the native Go compiler over app, config, resources, and routes in a couple of seconds.' },
      ],
      code: {
        file: 'tests/feature/posts.test.ts',
        code: `import { beforeEach, describe, expect, it } from 'bun:test'
import { actingAs } from '@stacksjs/testing'
import {
  factory,
  refreshDatabase,
} from '@stacksjs/testing/database'

describe('posts API', () => {
  beforeEach(refreshDatabase)

  it('lists posts for a signed-in user', async () => {
    const user = await factory('User').create()
    await factory('Post').createMany(3)

    const response = await actingAs(user as { id: number })
      .get('/api/posts')

    response.assertStatus(200)
    const body = await response.json<{ data: unknown[] }>()
    expect(body.data).toHaveLength(3)
  })
})`,
      },
      commands: [
        'buddy test',
        'buddy test:feature',
        'buddy typecheck',
      ],
      docs: '/docs',
      related: ['application-core', 'auth', 'cloud-deploys'],
    },
  },

  {
    slug: 'realtime-and-search',
    title: 'Realtime and search',
    blurb: 'Channels, broadcasts, websocket drivers, and app-level search workflows.',
    icon: 'i-hugeicons-satellite-02',
    group: 'run',
    bento: { cols: 3 },
    page: {
      kicker: 'Run',
      headline: 'Push it out, and let people find it.',
      lede: 'Broadcasting and search both start from a model you already defined. An event becomes a channel message, and a searchable trait becomes an index, without a second definition of what the record is.',
      capabilities: [
        { title: 'Channels', text: 'Public, private, and presence channels, authorized per channel, with an optional handshake check deciding who may connect at all.' },
        { title: 'Broadcasts', text: 'An event dispatched server-side arrives on the channel, so the same event can queue a job and update a screen.' },
        { title: 'WebSocket drivers', text: 'A first-party driver for development and pluggable transports for production.' },
        { title: 'Search engines', text: 'The useSearch trait indexes into OpenSearch, Meilisearch, Algolia, or Typesense, with searchable and filterable declared on the model.' },
        { title: 'Index sync', text: 'Model writes update the index through observers, so a record and its index entry do not disagree after an edit.' },
        { title: 'Client composables', text: 'STX composables subscribe in a script client block, leaving the server render untouched.' },
      ],
      code: {
        file: 'app/Events.ts',
        code: `import { defineEvents } from '@stacksjs/events'

// Listener names resolve from app/Listeners/, then
// app/Actions/. The key must be a declared event.
export default defineEvents({
  'order:updated': [
    'NotifyCustomer',
    'BroadcastToOrderChannel',
  ],
})

// resources/views/orders.stx, inside <script client>
//
//   import { useChannel } from '@stacksjs/stx/composables'
//   const channel = useChannel(\`orders.\${orderId}\`)
//   const status = state('processing')
//
//   channel.on('order:updated', (payload) => {
//     status.set(payload.status)
//   })`,
      },
      commands: [
        'buddy make:job ReindexArticles',
        'buddy dev api',
      ],
      docs: '/docs',
      related: ['queues-and-mail', 'cms', 'application-core'],
    },
  },

  {
    slug: 'cloud-deploys',
    title: 'Cloud deploys',
    blurb: 'Hetzner, AWS, or any box over SSH, with DNS, TLS, and mail, described in TypeScript config and shipped by Buddy.',
    icon: 'i-hugeicons-cloud-server',
    group: 'ship',
    bento: { cols: 6, visual: 'deploy', tone: 'gradient' },
    page: {
      kicker: 'Ship',
      headline: 'The infrastructure is part of the repo.',
      lede: 'config/cloud.ts describes the server, DNS, certificates, storage, and mail records in TypeScript. buddy deploy provisions Hetzner or AWS, or adopts a box you already own over SSH, then ships every surface, so production is a file you review in a pull request.',
      capabilities: [
        { title: 'One command', text: 'buddy deploy checks prerequisites, resolves the environment, builds the web, docs, blog, and API, then publishes the infrastructure.' },
        { title: 'DNS and TLS', text: 'Records and certificates are declared next to the site they belong to, so a new hostname is a config line rather than a console visit.' },
        { title: 'CDN and storage', text: 'Buckets, distributions, and cache invalidation come from the same config the application reads.' },
        { title: 'Mail records', text: 'SES identities plus the SPF, DKIM, and DMARC records that make them deliver, published with everything else.' },
        { title: 'Your own hardware', text: 'provider: ssh adopts a box you already run instead of provisioning one. buddy server:flash writes a Raspberry Pi OS or Ubuntu image to a disk, and on a LAN the box signs its own HTTPS certificate, which server:trust installs where your devices trust it.' },
        { title: 'Server or serverless', text: 'A long-running server by default; on AWS the same app can deploy serverless instead, chosen in config.' },
        { title: 'Many projects, one box', text: 'Several apps share a server behind one gateway, each with its own domains, certificates, and ports.' },
        { title: 'Rollback and backups', text: 'buddy deploy:rollback returns a site to its previous release, and db:backup, db:restore, storage:backup, and storage:restore cover the data.' },
        { title: 'Push to deploy', text: 'The shipped CI workflow runs buddy deploy on every green push to main, and finishes green with a notice when a repo has no deploy secrets yet.' },
      ],
      code: {
        file: 'config/cloud.ts',
        code: `import type { CloudConfig } from '@stacksjs/ts-cloud'

export const tsCloud: CloudConfig = {
  project: { name: 'app', slug: 'app', region: 'us-east-1' },
  cloud: { provider: 'hetzner' }, // or 'aws', 'ssh'
  mode: 'server',
  environments: {
    production: { type: 'production', deployBranch: 'main' },
  },

  infrastructure: {
    dns: { domain: 'example.com' },
    ssl: { enabled: true, provider: 'letsencrypt' },
    email: { domain: 'example.com', enableDkim: true },
  },

  sites: {
    main: { domain: 'example.com', port: 3000 },
    docs: { domain: 'example.com', path: '/docs' },
    api: { domain: 'api.example.com', port: 3008 },
  },
}`,
      },
      commands: [
        'buddy deploy',
        'buddy cloud --diff',
        'buddy domains:add example.com',
      ],
      docs: '/docs',
      related: ['storage', 'testing', 'queues-and-mail'],
    },
  },
]

export function featureBySlug(slug: string): Feature | undefined {
  return features.find(feature => feature.slug === slug)
}

export function featuresInGroup(group: string): Feature[] {
  return features.filter(feature => feature.group === group)
}
