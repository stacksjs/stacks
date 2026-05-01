import { Glob } from 'bun'

// Model name to icon mapping (SF Symbols)
export const iconMap: Record<string, string> = {
  user: 'person.fill',
  team: 'person.2.fill',
  subscriber: 'envelope.open.fill',
  subscriberemail: 'envelope.fill',
  post: 'doc.text.fill',
  page: 'doc.fill',
  product: 'cube.box.fill',
  productvariant: 'cube.fill',
  productunit: 'scalemass.fill',
  order: 'list.clipboard.fill',
  orderitem: 'list.bullet.clipboard.fill',
  customer: 'person.crop.circle.fill',
  payment: 'creditcard.fill',
  paymentmethod: 'creditcard.and.123',
  paymentproduct: 'creditcard.fill',
  paymenttransaction: 'creditcard.fill',
  category: 'tag.fill',
  tag: 'tag',
  comment: 'bubble.left.fill',
  author: 'person.text.rectangle.fill',
  notification: 'bell.fill',
  job: 'briefcase.fill',
  log: 'list.bullet.rectangle.portrait.fill',
  campaign: 'megaphone.fill',
  review: 'star.fill',
  coupon: 'ticket.fill',
  giftcard: 'giftcard.fill',
  cart: 'cart.fill',
  cartitem: 'cart.badge.plus',
  taxrate: 'percent',
  transaction: 'arrow.left.arrow.right.circle.fill',
  subscription: 'repeat.circle.fill',
  emaillist: 'envelope.badge.person.crop',
  socialpost: 'bubble.left.and.bubble.right.fill',
  manufacturer: 'building.2.fill',
  shippingmethod: 'shippingbox.fill',
  shippingzone: 'map.fill',
  shippingrate: 'dollarsign.circle.fill',
  deliveryroute: 'map.fill',
  driver: 'car.fill',
  digitaldelivery: 'arrow.down.doc.fill',
  licensekey: 'key.fill',
  loyaltypoint: 'star.circle.fill',
  loyaltyreward: 'gift.fill',
  printdevice: 'printer.fill',
  receipt: 'doc.text.fill',
  waitlistproduct: 'clock.fill',
  waitlistrestaurant: 'clock.badge.checkmark.fill',
  websocket: 'antenna.radiowaves.left.and.right',
  default: 'tablecells.fill',
}

// Models excluded from sidebar (already have dedicated pages)
export const excludeModels = new Set(['activity', 'request', 'error', 'failedjob'])

// Models that have dedicated dashboard pages
export const dedicatedPages = new Set(['user', 'team', 'subscriber', 'post', 'page', 'product', 'order', 'customer', 'payment', 'coupon', 'category', 'tag', 'comment', 'author', 'notification', 'job', 'campaign', 'review', 'gift-card'])

/**
 * Sidebar category each discovered model gets surfaced under.
 * - `userland`: model in the project's `app/Models/` (always shown in Data)
 * - `data`: framework root-level model that belongs in Data
 * - `commerce`: model in framework `commerce/` subdir or commerce-coded root model
 * - `content`: model in framework `Content/` subdir or content-coded root model
 * - `marketing`: outreach / subscriber-list models grouped under Marketing
 * - `system`: framework-internal models (jobs, deployments, requests…) → App
 */
export type ModelCategory = 'userland' | 'data' | 'commerce' | 'content' | 'marketing' | 'system'

// Curated category for framework-default models that live at the root of
// `storage/framework/defaults/app/Models/` (i.e. not under commerce/Content/realtime).
// Anything not in this map falls back to `data`, which keeps custom userland-
// style fixtures (e.g. tests scanning a temp dir) showing up in the Data section.
const ROOT_MODEL_CATEGORY: Record<string, ModelCategory> = {
  // Base data models — these already have dedicated pages, but tag them
  // anyway so the categorization is explicit if a future change adds rows.
  user: 'data',
  team: 'data',
  subscriber: 'data',
  activity: 'data',

  // Marketing / outreach
  campaign: 'marketing',
  emaillist: 'marketing',
  socialpost: 'marketing',
  subscriberemail: 'marketing',

  // Content
  comment: 'content',
  tag: 'content',

  // Commerce-adjacent root models
  paymentmethod: 'commerce',
  paymentproduct: 'commerce',
  paymenttransaction: 'commerce',
  subscription: 'commerce',

  // Framework-internal / app system models
  deployment: 'system',
  error: 'system',
  failedjob: 'system',
  job: 'system',
  log: 'system',
  notification: 'system',
  release: 'system',
  request: 'system',
}

export interface DiscoveredModel {
  name: string
  icon: string
  id: string
  category?: ModelCategory
}

/** Convert PascalCase model name to kebab-case ID */
export function modelNameToId(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
}

/** Get the icon for a model name, falling back to the default */
export function getModelIcon(name: string): string {
  return iconMap[name.toLowerCase()] || iconMap.default
}

/**
 * Decide a model's sidebar category from the path it was scanned from.
 *
 * `defaultCategory` — when provided, every file under `dir` gets that
 * category (used for the userland scan). When undefined, we infer per-file
 * based on the first path segment (commerce/, Content/, realtime/, …) and
 * fall back to ROOT_MODEL_CATEGORY for files at the dir root.
 */
function categorizeModel(relativePath: string, modelId: string, defaultCategory?: ModelCategory): ModelCategory {
  if (defaultCategory) return defaultCategory

  const firstSeg = relativePath.includes('/') ? relativePath.split('/')[0].toLowerCase() : ''
  if (firstSeg === 'commerce') return 'commerce'
  if (firstSeg === 'content') return 'content'
  if (firstSeg === 'realtime') return 'system'

  // Root-level framework model — look it up in the curated map; default to
  // `data` so unknown root models still surface in the Data section.
  return ROOT_MODEL_CATEGORY[modelId.replace(/-/g, '')] ?? 'data'
}

/** Scan a directory for model files and add them to the models array */
export async function scanModelsDir(
  dir: string,
  seenNames: Set<string>,
  models: DiscoveredModel[],
  defaultCategory?: ModelCategory,
): Promise<void> {
  try {
    const glob = new Glob('**/*.ts')
    for await (const file of glob.scan({ cwd: dir })) {
      if (file.includes('README') || file.includes('.d.ts')) continue
      const name = file.replace(/\.ts$/, '').split('/').pop() || ''
      const nameLower = name.toLowerCase()
      if (name && !seenNames.has(nameLower) && !excludeModels.has(nameLower)) {
        seenNames.add(nameLower)
        const id = modelNameToId(name)
        models.push({
          name,
          icon: getModelIcon(name),
          id,
          category: categorizeModel(file, id, defaultCategory),
        })
      }
    }
  }
  catch {
    // Directory may not exist
  }
}

/** Discover models from both user and default directories */
export async function discoverModels(userModelsPath: string, defaultModelsPath: string): Promise<DiscoveredModel[]> {
  const models: DiscoveredModel[] = []
  const seenNames = new Set<string>()
  await Promise.all([
    scanModelsDir(userModelsPath, seenNames, models, 'userland'),
    scanModelsDir(defaultModelsPath, seenNames, models),
  ])
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

/** Build the manifest array for discovered models */
export function buildManifest(models: DiscoveredModel[]): Array<{ id: string, name: string, icon: string, hasDedicatedPage: boolean, category: ModelCategory }> {
  return models.map(m => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    hasDedicatedPage: dedicatedPages.has(m.id),
    category: m.category ?? 'data',
  }))
}

/** Check if a port is available by attempting to listen on it */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({ port, fetch: () => new Response() })
    server.stop(true)
    return true
  }
  catch {
    return false
  }
}

/** Find an available port starting from the preferred port */
export async function findAvailablePort(preferred: number, maxAttempts = 20): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i
    if (await isPortAvailable(port)) return port
  }
  return preferred
}

/** Wait for STX server to accept connections */
export async function waitForServer(port: number, maxWait = 500): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`http://localhost:${port}/home`, { method: 'HEAD' })
      if (res.ok || res.status === 404) return true
    }
    catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  return false
}

/**
 * Per-section toggles. Read from the project's `config/dashboard.ts` (when
 * present) and passed through buildSidebarConfig / buildSidebarNavHtml so the
 * commerce / content / marketing sections collapse out of the sidebar entirely
 * for projects that don't ship those features. Anything not specified is on.
 */
export interface DashboardSectionToggles {
  commerce?: boolean
  content?: boolean
  marketing?: boolean
  analytics?: boolean
  management?: boolean
  utilities?: boolean
  library?: boolean
}

/**
 * Pull `discoveredModels` rows for a given category and turn them into
 * native-sidebar items. The row visually lives under e.g. Commerce, but
 * the URL always points at `/data/<id>` because that's the only dynamic
 * model viewer route the dashboard ships — there is no `/commerce/[model]`
 * catch-all. The `dedicated` skip-set prevents double-listing models that
 * the section already surfaces as a hand-built static row.
 */
function categoryRows(
  baseRoute: string,
  models: DiscoveredModel[],
  category: ModelCategory,
  dedicated: Set<string>,
): Array<{ id: string, label: string, icon: string, url: string }> {
  return models
    .filter(m => (m.category ?? 'data') === category)
    .filter(m => !dedicatedPages.has(m.id) && !dedicated.has(m.id))
    .map(m => ({
      id: `model-${m.id}`,
      label: m.name,
      icon: m.icon,
      url: `${baseRoute}/data/${m.id}`,
    }))
}

/** Build sidebar config for native sidebar navigation */
export function buildSidebarConfig(
  baseRoute: string,
  discoveredModels: DiscoveredModel[],
  toggles: DashboardSectionToggles = {},
) {
  // Default every section on; the `?? true` lets the user turn one off
  // by setting it to `false` in `config/dashboard.ts`.
  const enabled = {
    library: toggles.library ?? true,
    content: toggles.content ?? true,
    commerce: toggles.commerce ?? true,
    marketing: toggles.marketing ?? true,
    analytics: toggles.analytics ?? true,
    management: toggles.management ?? true,
    utilities: toggles.utilities ?? true,
  }

  const sections: Array<{ id: string, title: string, items: Array<{ id: string, label: string, icon: string, url: string }> }> = []

  sections.push({
    id: 'home',
    title: 'Home',
    items: [
      { id: 'home', label: 'Dashboard', icon: 'house.fill', url: `${baseRoute}/home` },
      { id: 'dependencies', label: 'Dependencies', icon: 'shippingbox.fill', url: `${baseRoute}/home/dependencies` },
      { id: 'services', label: 'Services', icon: 'square.stack.3d.up.fill', url: `${baseRoute}/home/services` },
    ],
  })

  if (enabled.library) {
    sections.push({
      id: 'library',
      title: 'Library',
      items: [
        { id: 'components', label: 'Components', icon: 'puzzlepiece.fill', url: `${baseRoute}/library/components` },
        { id: 'functions', label: 'Functions', icon: 'function', url: `${baseRoute}/library/functions` },
        { id: 'packages', label: 'Packages', icon: 'shippingbox.fill', url: `${baseRoute}/library/packages` },
      ],
    })
  }

  if (enabled.content) {
    sections.push({
      id: 'content',
      title: 'Content',
      items: [
        { id: 'content-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent', url: `${baseRoute}/content/dashboard` },
        { id: 'files', label: 'Files', icon: 'folder.fill', url: `${baseRoute}/content/files` },
        { id: 'pages', label: 'Pages', icon: 'doc.fill', url: `${baseRoute}/content/pages` },
        { id: 'posts', label: 'Posts', icon: 'text.bubble.fill', url: `${baseRoute}/content/posts` },
        { id: 'categories', label: 'Categories', icon: 'tag.fill', url: `${baseRoute}/content/categories` },
        { id: 'tags', label: 'Tags', icon: 'tag', url: `${baseRoute}/content/tags` },
        { id: 'comments', label: 'Comments', icon: 'bubble.left.fill', url: `${baseRoute}/content/comments` },
        { id: 'authors', label: 'Authors', icon: 'person.text.rectangle.fill', url: `${baseRoute}/content/authors` },
        { id: 'seo', label: 'SEO', icon: 'magnifyingglass', url: `${baseRoute}/content/seo` },
        // Userland/framework `Content/` models without a dedicated page get a
        // dynamic row appended here instead of polluting Data.
        ...categoryRows(baseRoute, discoveredModels, 'content', new Set([
          'page', 'post', 'category', 'tag', 'comment', 'author',
        ])),
      ],
    })
  }

  sections.push({
    id: 'app',
    title: 'App',
    items: [
      { id: 'deployments', label: 'Deployments', icon: 'rocket.fill', url: `${baseRoute}/app/deployments` },
      { id: 'requests', label: 'Requests', icon: 'arrow.left.arrow.right', url: `${baseRoute}/app/requests` },
      { id: 'realtime', label: 'Realtime', icon: 'link', url: `${baseRoute}/app/realtime` },
      { id: 'actions', label: 'Actions', icon: 'bolt.fill', url: `${baseRoute}/app/actions` },
      { id: 'commands', label: 'Commands', icon: 'terminal.fill', url: `${baseRoute}/app/commands` },
      { id: 'queue', label: 'Queue', icon: 'list.bullet.rectangle.fill', url: `${baseRoute}/app/queue` },
      { id: 'jobs', label: 'Jobs', icon: 'briefcase.fill', url: `${baseRoute}/app/jobs` },
      { id: 'inbox', label: 'Inbox', icon: 'tray.full.fill', url: `${baseRoute}/app/inbox` },
      { id: 'queries', label: 'Queries', icon: 'magnifyingglass.circle.fill', url: `${baseRoute}/app/queries` },
      { id: 'notifications', label: 'Notifications', icon: 'bell.fill', url: `${baseRoute}/app/notifications` },
      ...categoryRows(baseRoute, discoveredModels, 'system', new Set()),
    ],
  })

  // Data section is now strictly: base Stacks rows + ALL Models, plus any
  // model the project actually defined under `app/Models/` (category =
  // 'userland') and root-level framework models that fall back to 'data'.
  // Commerce / content / marketing models no longer leak in here.
  sections.push({
    id: 'data',
    title: 'Data',
    items: [
      { id: 'data-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent', url: `${baseRoute}/data/dashboard` },
      { id: 'activity', label: 'Activity', icon: 'waveform.path.ecg', url: `${baseRoute}/data/activity` },
      { id: 'users', label: 'Users', icon: 'person.crop.circle.fill', url: `${baseRoute}/data/users` },
      { id: 'teams', label: 'Teams', icon: 'person.3.fill', url: `${baseRoute}/data/teams` },
      { id: 'subscribers', label: 'Subscribers', icon: 'envelope.fill', url: `${baseRoute}/data/subscribers` },
      { id: 'data-models', label: 'All Models', icon: 'square.grid.2x2.fill', url: `${baseRoute}/data/models` },
      ...discoveredModels
        .filter(m => m.category === 'userland' || m.category === 'data' || m.category === undefined)
        .filter(m => !dedicatedPages.has(m.id))
        .map(model => ({
          id: `model-${model.id}`,
          label: model.name,
          icon: model.icon,
          url: `${baseRoute}/data/${model.id}`,
        })),
    ],
  })

  if (enabled.commerce) {
    sections.push({
      id: 'commerce',
      title: 'Commerce',
      items: [
        { id: 'commerce-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent', url: `${baseRoute}/commerce/dashboard` },
        { id: 'customers', label: 'Customers', icon: 'person.crop.circle.fill', url: `${baseRoute}/commerce/customers` },
        { id: 'orders', label: 'Orders', icon: 'list.clipboard.fill', url: `${baseRoute}/commerce/orders` },
        { id: 'products', label: 'Products', icon: 'cube.box.fill', url: `${baseRoute}/commerce/products` },
        { id: 'coupons', label: 'Coupons', icon: 'ticket.fill', url: `${baseRoute}/commerce/coupons` },
        { id: 'gift-cards', label: 'Gift Cards', icon: 'giftcard.fill', url: `${baseRoute}/commerce/gift-cards` },
        { id: 'payments', label: 'Payments', icon: 'creditcard.fill', url: `${baseRoute}/commerce/payments` },
        { id: 'delivery', label: 'Delivery', icon: 'truck.box.fill', url: `${baseRoute}/commerce/delivery` },
        { id: 'taxes', label: 'Taxes', icon: 'percent', url: `${baseRoute}/commerce/taxes` },
        ...categoryRows(baseRoute, discoveredModels, 'commerce', new Set([
          'customer', 'order', 'product', 'coupon', 'gift-card', 'payment', 'review', 'category',
        ])),
      ],
    })
  }

  if (enabled.marketing) {
    sections.push({
      id: 'marketing',
      title: 'Marketing',
      items: [
        { id: 'lists', label: 'Lists', icon: 'list.bullet', url: `${baseRoute}/marketing/lists` },
        { id: 'social-posts', label: 'Social Posts', icon: 'clock.fill', url: `${baseRoute}/marketing/social-posts` },
        { id: 'campaigns', label: 'Campaigns', icon: 'megaphone.fill', url: `${baseRoute}/marketing/campaigns` },
        { id: 'marketing-reviews', label: 'Reviews', icon: 'star.fill', url: `${baseRoute}/marketing/reviews` },
        ...categoryRows(baseRoute, discoveredModels, 'marketing', new Set(['campaign'])),
      ],
    })
  }

  if (enabled.analytics) {
    sections.push({
      id: 'analytics',
      title: 'Analytics',
      items: [
        { id: 'analytics-web', label: 'Web', icon: 'globe', url: `${baseRoute}/analytics/web` },
        { id: 'analytics-blog', label: 'Blog', icon: 'doc.text.fill', url: `${baseRoute}/analytics/blog` },
        { id: 'analytics-commerce', label: 'Commerce', icon: 'cart.fill', url: `${baseRoute}/analytics/commerce` },
        { id: 'analytics-marketing', label: 'Marketing', icon: 'megaphone.fill', url: `${baseRoute}/analytics/marketing` },
      ],
    })
  }

  if (enabled.management) {
    sections.push({
      id: 'management',
      title: 'Management',
      items: [
        { id: 'cloud', label: 'Cloud', icon: 'cloud.fill', url: `${baseRoute}/management/cloud` },
        { id: 'servers', label: 'Servers', icon: 'server.rack', url: `${baseRoute}/management/servers` },
        { id: 'serverless', label: 'Serverless', icon: 'bolt.horizontal.circle.fill', url: `${baseRoute}/management/serverless` },
        { id: 'dns', label: 'DNS', icon: 'network', url: `${baseRoute}/management/dns` },
        { id: 'mailboxes', label: 'Mailboxes', icon: 'tray.full.fill', url: `${baseRoute}/management/mailboxes` },
        { id: 'logs', label: 'Logs', icon: 'list.bullet.rectangle.portrait.fill', url: `${baseRoute}/management/logs` },
      ],
    })
  }

  if (enabled.utilities) {
    sections.push({
      id: 'utilities',
      title: 'Utilities',
      items: [
        { id: 'buddy', label: 'AI Buddy', icon: 'bubble.left.and.bubble.right.fill', url: `${baseRoute}/utilities/buddy` },
        { id: 'environment', label: 'Environment', icon: 'key.fill', url: `${baseRoute}/utilities/environment` },
        { id: 'access-tokens', label: 'Access Tokens', icon: 'key.horizontal.fill', url: `${baseRoute}/utilities/access-tokens` },
        { id: 'settings', label: 'Settings', icon: 'gear', url: `${baseRoute}/utilities/settings` },
      ],
    })
  }

  return {
    sections,
    minWidth: 200,
    maxWidth: 280,
  }
}

/**
 * Build the URL the Craft window opens to. The `native-sidebar=1` query
 * param signals the layout that Craft is rendering the sidebar natively,
 * so the layout can suppress its own HTML sidebar and let the macOS
 * NSOutlineView own that 240px column.
 */
export function buildDashboardUrl(port: number): string {
  return `http://localhost:${port}/home?native-sidebar=1`
}
