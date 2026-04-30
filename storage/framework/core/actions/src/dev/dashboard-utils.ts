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

export interface DiscoveredModel {
  name: string
  icon: string
  id: string
}

/** Convert PascalCase model name to kebab-case ID */
export function modelNameToId(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
}

/** Get the icon for a model name, falling back to the default */
export function getModelIcon(name: string): string {
  return iconMap[name.toLowerCase()] || iconMap.default
}

/** Scan a directory for model files and add them to the models array */
export async function scanModelsDir(
  dir: string,
  seenNames: Set<string>,
  models: DiscoveredModel[],
): Promise<void> {
  try {
    const glob = new Glob('**/*.ts')
    for await (const file of glob.scan({ cwd: dir })) {
      if (file.includes('README') || file.includes('.d.ts')) continue
      const name = file.replace(/\.ts$/, '').split('/').pop() || ''
      const nameLower = name.toLowerCase()
      if (name && !seenNames.has(nameLower) && !excludeModels.has(nameLower)) {
        seenNames.add(nameLower)
        models.push({ name, icon: getModelIcon(name), id: modelNameToId(name) })
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
    scanModelsDir(userModelsPath, seenNames, models),
    scanModelsDir(defaultModelsPath, seenNames, models),
  ])
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

/** Build the manifest array for discovered models */
export function buildManifest(models: DiscoveredModel[]): Array<{ id: string, name: string, icon: string, hasDedicatedPage: boolean }> {
  return models.map(m => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    hasDedicatedPage: dedicatedPages.has(m.id),
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

/** Build sidebar config for native sidebar navigation */
export function buildSidebarConfig(baseRoute: string, discoveredModels: DiscoveredModel[]) {
  return {
    sections: [
      {
        id: 'home',
        title: 'Home',
        items: [
          { id: 'home', label: 'Dashboard', icon: 'house.fill', url: `${baseRoute}/home` },
          { id: 'dependencies', label: 'Dependencies', icon: 'shippingbox.fill', url: `${baseRoute}/home/dependencies` },
          { id: 'services', label: 'Services', icon: 'square.stack.3d.up.fill', url: `${baseRoute}/home/services` },
        ],
      },
      {
        id: 'library',
        title: 'Library',
        items: [
          { id: 'components', label: 'Components', icon: 'puzzlepiece.fill', url: `${baseRoute}/library/components` },
          { id: 'functions', label: 'Functions', icon: 'function', url: `${baseRoute}/library/functions` },
          { id: 'packages', label: 'Packages', icon: 'shippingbox.fill', url: `${baseRoute}/library/packages` },
        ],
      },
      {
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
        ],
      },
      {
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
        ],
      },
      {
        id: 'data',
        title: 'Data',
        items: [
          { id: 'data-dashboard', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent', url: `${baseRoute}/data/dashboard` },
          { id: 'activity', label: 'Activity', icon: 'waveform.path.ecg', url: `${baseRoute}/data/activity` },
          ...discoveredModels.map(model => ({
            id: `model-${model.id}`,
            label: model.name,
            icon: model.icon,
            url: `${baseRoute}/data/${model.id}`,
          })),
        ],
      },
      {
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
        ],
      },
      {
        id: 'marketing',
        title: 'Marketing',
        items: [
          { id: 'lists', label: 'Lists', icon: 'list.bullet', url: `${baseRoute}/marketing/lists` },
          { id: 'social-posts', label: 'Social Posts', icon: 'clock.fill', url: `${baseRoute}/marketing/social-posts` },
          { id: 'campaigns', label: 'Campaigns', icon: 'megaphone.fill', url: `${baseRoute}/marketing/campaigns` },
          { id: 'marketing-reviews', label: 'Reviews', icon: 'star.fill', url: `${baseRoute}/marketing/reviews` },
        ],
      },
      {
        id: 'analytics',
        title: 'Analytics',
        items: [
          { id: 'analytics-web', label: 'Web', icon: 'globe', url: `${baseRoute}/analytics/web` },
          { id: 'analytics-blog', label: 'Blog', icon: 'doc.text.fill', url: `${baseRoute}/analytics/blog` },
          { id: 'analytics-commerce', label: 'Commerce', icon: 'cart.fill', url: `${baseRoute}/analytics/commerce` },
          { id: 'analytics-marketing', label: 'Marketing', icon: 'megaphone.fill', url: `${baseRoute}/analytics/marketing` },
        ],
      },
      {
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
      },
      {
        id: 'utilities',
        title: 'Utilities',
        items: [
          { id: 'buddy', label: 'AI Buddy', icon: 'bubble.left.and.bubble.right.fill', url: `${baseRoute}/utilities/buddy` },
          { id: 'environment', label: 'Environment', icon: 'key.fill', url: `${baseRoute}/utilities/environment` },
          { id: 'access-tokens', label: 'Access Tokens', icon: 'key.horizontal.fill', url: `${baseRoute}/utilities/access-tokens` },
          { id: 'settings', label: 'Settings', icon: 'gear', url: `${baseRoute}/utilities/settings` },
        ],
      },
    ],
    minWidth: 200,
    maxWidth: 280,
  }
}

/** Build the initial URL with native-sidebar flag */
export function buildDashboardUrl(port: number): string {
  return `http://localhost:${port}/home?native-sidebar=1`
}
