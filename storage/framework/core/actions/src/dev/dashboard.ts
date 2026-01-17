import { spawn } from 'node:child_process'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { Glob } from 'bun'

const dashboardPath = storagePath('framework/defaults/dashboard')

// Discover models from both user and default directories
async function discoverModels(): Promise<Array<{ name: string, icon: string, id: string }>> {
  const models: Array<{ name: string, icon: string, id: string }> = []
  const seenNames = new Set<string>()

  // Models to exclude (already have dedicated pages)
  const excludeModels = new Set(['activity', 'request', 'error', 'failedjob'])

  // Model name to icon mapping
  const iconMap: Record<string, string> = {
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

  // Scan user models (app/Models)
  const userModelsPath = projectPath('app/Models')
  try {
    const glob = new Glob('**/*.ts')
    for await (const file of glob.scan({ cwd: userModelsPath })) {
      if (file.includes('README') || file.includes('.d.ts')) continue
      const name = file.replace(/\.ts$/, '').split('/').pop() || ''
      const nameLower = name.toLowerCase()
      if (name && !seenNames.has(nameLower) && !excludeModels.has(nameLower)) {
        seenNames.add(nameLower)
        const id = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
        const icon = iconMap[nameLower] || iconMap.default
        models.push({ name, icon, id })
      }
    }
  } catch {
    // User models directory may not exist
  }

  // Scan ALL default models (storage/framework/defaults/models) including subdirectories
  const defaultModelsPath = storagePath('framework/defaults/models')
  try {
    const glob = new Glob('**/*.ts')
    for await (const file of glob.scan({ cwd: defaultModelsPath })) {
      if (file.includes('README') || file.includes('.d.ts')) continue
      const name = file.replace(/\.ts$/, '').split('/').pop() || ''
      const nameLower = name.toLowerCase()
      if (name && !seenNames.has(nameLower) && !excludeModels.has(nameLower)) {
        seenNames.add(nameLower)
        const id = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
        const icon = iconMap[nameLower] || iconMap.default
        models.push({ name, icon, id })
      }
    }
  } catch {
    // Default models directory may not exist
  }

  return models.sort((a, b) => a.name.localeCompare(b.name))
}

// Get discovered models
const discoveredModels = await discoverModels()

log.info('Starting Stacks Dashboard...')
log.info(`Dashboard path: ${dashboardPath}`)

// Start STX dev server for the dashboard
const dashboardPort = 3456

log.info(`Starting STX dev server on http://localhost:${dashboardPort}...`)

let serverStarted = false

try {
  const { serve } = await import('bun-plugin-stx/serve')

  // Run serve in background - don't await since it blocks forever
  const serverPromise = serve({
    patterns: [dashboardPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/components/Dashboard'),
    layoutsDir: `${dashboardPath}/layouts`,
    partialsDir: dashboardPath,
  })

  // Set up error handler but don't let it kill the process
  serverPromise.catch((err: Error) => {
    if (!serverStarted) {
      log.warn(`STX server issue: ${err.message}`)
    }
  })

  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 500))
  serverStarted = true
  log.success(`STX dev server running on http://localhost:${dashboardPort}`)
}
catch (err: any) {
  log.warn(`STX server warning: ${err.message || err}`)
  log.info('Continuing with Craft launch...')
}

// Path to the Craft binary - check common locations (craft-minimal parses CLI args)
const craftPaths = [
  projectPath('../craft/packages/zig/zig-out/bin/craft-minimal'), // Development location (monorepo)
  projectPath('../craft/zig-out/bin/craft-minimal'), // Development location (single package)
  '/usr/local/bin/craft', // Installed location
  projectPath('node_modules/.bin/craft'), // npm installed
]

let craftBinary: string | null = null
for (const craftPath of craftPaths) {
  try {
    const file = Bun.file(craftPath)
    if (await file.exists()) {
      craftBinary = craftPath
      log.info(`Found Craft at: ${craftPath}`)
      break
    }
  }
  catch {
    // Continue checking
  }
}

if (!craftBinary) {
  log.error('Could not find Craft binary. Please build Craft first:')
  log.info('  cd ~/Code/craft && zig build')
  process.exit(1)
}

// Build sidebar config - each item needs a url for navigation
// Routes are served from storage/framework/defaults/dashboard/pages/ at /pages/* paths
const serverUrl = `http://localhost:${dashboardPort}`
const baseRoute = `${serverUrl}/pages`
const sidebarConfig = {
  sections: [
    {
      id: 'home',
      title: 'Home',
      items: [
        { id: 'home', label: 'Dashboard', icon: 'house.fill', url: `${baseRoute}/index` },
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
        // Add discovered models dynamically
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

// Convert sidebar config to JSON string for CLI
const sidebarConfigJson = JSON.stringify(sidebarConfig)

log.info('Launching Craft with native macOS sidebar...')
log.info(`Using Craft binary: ${craftBinary}`)
log.info(`Sidebar width: 240px`)
log.info(`Window size: 1400x900`)

// Initial URL to load - STX server handles all routing
// Routes map to storage/framework/defaults/dashboard/pages/*.stx files
const initialUrl = `http://localhost:${dashboardPort}/pages/index`

// Launch Craft with native macOS Tahoe sidebar
// The sidebar is rendered natively by Craft, not by STX
const craftProcess = spawn(craftBinary!, [
  '--title', 'Stacks Dashboard',
  '--url', initialUrl,
  '--width', '1400',
  '--height', '900',
  '--native-sidebar',
  '--sidebar-config', sidebarConfigJson,
  '--sidebar-width', '240',
], {
  stdio: 'inherit',
  cwd: dashboardPath,
})

craftProcess.on('error', (err) => {
  log.error(`Failed to start Craft: ${err.message}`)
  log.info('Make sure Craft is built. Run: cd ~/Code/craft && zig build')
  process.exit(1)
})

craftProcess.on('close', (code) => {
  log.info(`Dashboard closed with code ${code}`)
  process.exit(code || 0)
})

// Keep the process running
process.on('SIGINT', () => {
  craftProcess.kill()
  process.exit(0)
})

process.on('SIGTERM', () => {
  craftProcess.kill()
  process.exit(0)
})
