/**
 * Dashboard sidebar navigation data.
 *
 * Discovers model-provided dashboard rows and shapes every section for the
 * native STX Sidebar component. Markup, icons, disclosure state, and
 * persistence stay inside the component instead of being serialized as HTML.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type ModelCategory = 'userland' | 'data' | 'commerce' | 'content' | 'marketing' | 'system'

/**
 * Per-model dashboard configuration shape (stacksjs/stacks#1843).
 * Mirror of `DashboardModelOptions` in `@stacksjs/types` — duplicated here
 * because this file is consumed from STX server-script context where the
 * full type imports aren't available. Keep in sync with the source.
 */
interface DashboardModelOptionsLite {
  enabled?: boolean
  label?: string
  icon?: string
  section?: string
  roles?: string[]
  description?: string
}

export interface DiscoveredModel {
  id: string
  name: string
  icon?: string
  hasDedicatedPage?: boolean
  category?: ModelCategory
  /** Per-model dashboard config from `defineModel({ dashboard: … })`. */
  dashboard?: DashboardModelOptionsLite
}

export interface DataRowToggles {
  dashboard: boolean
  activity: boolean
  users: boolean
  teams: boolean
  subscribers: boolean
  allModels: boolean
}

export interface DashboardSectionToggles {
  library: boolean
  content: boolean
  commerce: boolean
  marketing: boolean
  analytics: boolean
  management: boolean
  utilities: boolean
  /** CI tracking surface (stacksjs/stacks#1844). Lives under management. */
  ci?: boolean
  data: DataRowToggles
}

export interface DiscoveredManifest {
  models: DiscoveredModel[]
  sections: DashboardSectionToggles
}

export const DEFAULT_DATA_TOGGLES: DataRowToggles = {
  dashboard: true,
  activity: true,
  users: true,
  teams: true,
  subscribers: true,
  allModels: true,
}

export const DEFAULT_TOGGLES: DashboardSectionToggles = {
  library: true,
  content: true,
  commerce: true,
  marketing: true,
  analytics: true,
  management: true,
  utilities: true,
  data: DEFAULT_DATA_TOGGLES,
}

interface NavItem {
  to: string
  icon: string
  text: string
  /**
   * Role-gate metadata for sidebar items (stacksjs/stacks#1843).
   * The layout maps this metadata to component row IDs and hides rows from
   * viewers who do not hold a matching role.
   */
  roles?: string[]
}

/**
 * Pull the discovered-models manifest from the framework defaults dir.
 * Returns the default empty payload when the file is absent (fresh project
 * before the first dashboard run regenerates it).
 */
export function loadDiscoveredManifest(
  manifestPath = resolve(process.cwd(), 'storage/framework/defaults/views/dashboard/.discovered-models.json'),
): DiscoveredManifest {
  if (!existsSync(manifestPath))
    return { models: [], sections: defaultToggles() }

  try {
    return parseDiscoveredManifest(readFileSync(manifestPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`Could not read dashboard model manifest: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseDiscoveredManifest(source: string): DiscoveredManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  }
  catch (error) {
    throw new Error(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  const envelope = objectValue(parsed, 'manifest')
  if (!Array.isArray(envelope.models))
    throw new TypeError('manifest models must be an array')

  const models = envelope.models.map((value, index) => {
    const model = objectValue(value, `manifest models[${index}]`)
    if (typeof model.id !== 'string' || !model.id)
      throw new TypeError(`manifest models[${index}].id must be a non-empty string`)
    if (typeof model.name !== 'string' || !model.name)
      throw new TypeError(`manifest models[${index}].name must be a non-empty string`)
    return model as unknown as DiscoveredModel
  }).sort((a, b) => a.name.localeCompare(b.name))

  return {
    models,
    sections: normalizeManifestToggles(envelope.sections),
  }
}

function normalizeManifestToggles(value: unknown): DashboardSectionToggles {
  const sections = objectValue(value, 'manifest sections')
  const data = sections.data === undefined
    ? {}
    : objectValue(sections.data, 'manifest sections.data')

  return {
    library: booleanValue(sections.library, 'manifest sections.library', true),
    content: booleanValue(sections.content, 'manifest sections.content', true),
    commerce: booleanValue(sections.commerce, 'manifest sections.commerce', true),
    marketing: booleanValue(sections.marketing, 'manifest sections.marketing', true),
    analytics: booleanValue(sections.analytics, 'manifest sections.analytics', true),
    management: booleanValue(sections.management, 'manifest sections.management', true),
    utilities: booleanValue(sections.utilities, 'manifest sections.utilities', true),
    ci: booleanValue(sections.ci, 'manifest sections.ci', false),
    data: {
      dashboard: booleanValue(data.dashboard, 'manifest sections.data.dashboard', true),
      activity: booleanValue(data.activity, 'manifest sections.data.activity', true),
      users: booleanValue(data.users, 'manifest sections.data.users', true),
      teams: booleanValue(data.teams, 'manifest sections.data.teams', true),
      subscribers: booleanValue(data.subscribers, 'manifest sections.data.subscribers', true),
      allModels: booleanValue(data.allModels, 'manifest sections.data.allModels', true),
    },
  }
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`)
  return value as Record<string, unknown>
}

function booleanValue(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined)
    return fallback
  if (typeof value !== 'boolean')
    throw new TypeError(`${label} must be a boolean`)
  return value
}

function defaultToggles(): DashboardSectionToggles {
  return {
    ...DEFAULT_TOGGLES,
    data: { ...DEFAULT_DATA_TOGGLES },
  }
}

/** Return only the discovered model list for callers that do not need toggles. */
export function loadDiscoveredModels(): DiscoveredModel[] {
  return loadDiscoveredManifest().models
}

/**
 * Pick discovered-model rows that belong to a category and turn them into
 * web-sidebar nav items. The row visually lives under the categorized
 * section but always links to `/models/<id>` — that's the dashboard's
 * dynamic ORM viewer (`views/dashboard/models/[model].stx`), and the
 * only catch-all that resolves arbitrary slugs. `dedicated` skips models
 * the section already surfaces as a hand-built static row (e.g.
 * `/commerce/customers` already exists, so the Customer model row would
 * just duplicate it).
 *
 * The section a model surfaces under, after honouring the model's
 * `dashboard.section` override. When no override is set, falls back to
 * the path-derived category. Returns `undefined` when the model is
 * explicitly disabled so callers can skip the row.
 */
function effectiveCategory(m: DiscoveredModel): string | undefined {
  if (m.dashboard?.enabled === false)
    return undefined
  if (m.dashboard?.section)
    return m.dashboard.section
  return m.category ?? 'data'
}

function categoryNavItems(
  models: DiscoveredModel[],
  category: ModelCategory,
  dedicated: Set<string>,
): NavItem[] {
  return models
    .filter(m => effectiveCategory(m) === category)
    .filter(m => !m.hasDedicatedPage && !dedicated.has(m.id))
    .map((m): NavItem => ({
      to: `/models/${m.id}`,
      icon: m.dashboard?.icon ?? m.icon ?? 'table',
      text: m.dashboard?.label ?? m.name,
      ...(m.dashboard?.roles && m.dashboard.roles.length > 0
        ? { roles: m.dashboard.roles }
        : {}),
    }))
}

/**
 * The sidebar's navigation tree as data: `[sectionKey, sectionLabel, items]`
 * per section, with all toggle and model logic applied.
 */
export function buildNavSections(
  discoveredModels: DiscoveredModel[] = [],
  toggles: DashboardSectionToggles = DEFAULT_TOGGLES,
): Array<[string, string, NavItem[]]> {
  const sections: Array<[string, string, NavItem[]]> = []

  // Library section: the established views live at the project root
  // (`/functions`, `/packages`, `/releases`). Components use the explicit
  // `/library/components` path so it does not collide with STX's component
  // source directory.
  if (toggles.library) {
    sections.push(['library', 'library', [
      { to: '/library/components', icon: 'layout-table-01', text: 'Components' },
      { to: '/functions', icon: 'function', text: 'Functions' },
      { to: '/releases', icon: 'list-number', text: 'Releases' },
      { to: '/packages', icon: 'package', text: 'Packages' },
    ]])
  }

  if (toggles.content) {
    sections.push(['content', 'content', [
      { to: '/content/dashboard', icon: 'dashboard', text: 'Dashboard' },
      { to: '/content/files', icon: 'files', text: 'Files' },
      { to: '/content/blog', icon: 'post', text: 'Blog' },
      { to: '/content/pages', icon: 'file', text: 'Pages' },
      { to: '/content/posts', icon: 'post', text: 'Posts' },
      { to: '/content/categories', icon: 'tags', text: 'Categories' },
      { to: '/content/tags', icon: 'tag', text: 'Tags' },
      { to: '/content/comments', icon: 'comment', text: 'Comments' },
      { to: '/content/authors', icon: 'user-edit', text: 'Authors' },
      { to: '/content/seo', icon: 'seo', text: 'SEO' },
      ...categoryNavItems(discoveredModels, 'content', new Set([
        'page', 'post', 'category', 'tag', 'comment', 'author',
      ])),
    ]])
  }

  // App section: every page lives at a flat root path (`/jobs`, `/queue`,
  // `/inbox`, etc.). The historical `/app/*` prefix never matched a real
  // file. Notifications resolves to the dashboard variant
  // (`/notifications/dashboard`); the bare `/notifications` redirects.
  sections.push(['app', 'app', [
    { to: '/deployments', icon: 'rocket', text: 'Deployments' },
    { to: '/requests', icon: 'api', text: 'Requests' },
    { to: '/realtime', icon: 'link', text: 'Realtime' },
    { to: '/actions', icon: 'bolt', text: 'Actions' },
    { to: '/commands', icon: 'terminal', text: 'Commands' },
    { to: '/queue', icon: 'queue', text: 'Queue' },
    { to: '/jobs', icon: 'briefcase', text: 'Jobs' },
    { to: '/jobs/history', icon: 'clock', text: 'Job History' },
    { to: '/queries', icon: 'search', text: 'Queries' },
    { to: '/queries/slow', icon: 'clock', text: 'Slow Queries' },
    { to: '/queries/history', icon: 'log', text: 'Query History' },
    { to: '/errors', icon: 'log', text: 'Errors' },
    { to: '/notifications/dashboard', icon: 'bell', text: 'Notifications' },
    { to: '/inbox', icon: 'mail', text: 'Inbox' },
    { to: '/inbox/activity', icon: 'activity', text: 'Mail Activity' },
    { to: '/inbox/captured', icon: 'mail-send-02', text: 'Captured Mail' },
    { to: '/inbox/settings', icon: 'settings', text: 'Mail Settings' },
    ...categoryNavItems(discoveredModels, 'system', new Set()),
  ]])

  // Data section: configurable basic rows + ALL userland models + any
  // root-level framework `data` models. Per-row toggles let projects hide
  // the basic rows they don't need; userland models always appear.
  // Per-model rows link to `/models/<id>` (dynamic ORM viewer); the
  // built-in dashboard / activity / users / teams / subscribers rows keep
  // their bespoke pages under `/data/<row>`.
  const dataRows = toggles.data ?? DEFAULT_DATA_TOGGLES
  const dataNav: NavItem[] = []
  if (dataRows.dashboard) dataNav.push({ to: '/data/dashboard', icon: 'dashboard', text: 'Dashboard' })
  if (dataRows.activity) dataNav.push({ to: '/data/activity', icon: 'activity', text: 'Activity' })
  if (dataRows.users) dataNav.push({ to: '/data/users', icon: 'users', text: 'Users' })
  if (dataRows.teams) dataNav.push({ to: '/data/teams', icon: 'group', text: 'Teams' })
  if (dataRows.subscribers) dataNav.push({ to: '/data/subscribers', icon: 'mail', text: 'Subscribers' })
  if (dataRows.allModels) dataNav.push({ to: '/models', icon: 'table', text: 'All Models' })
  for (const m of discoveredModels) {
    // Skip when:
    //   - explicit `dashboard.enabled === false` (effectiveCategory returns undefined)
    //   - pinned to a different section via `dashboard.section`
    //   - already has a dedicated dashboard page
    const eff = effectiveCategory(m)
    if (eff !== 'userland' && eff !== 'data') continue
    if (m.hasDedicatedPage) continue
    dataNav.push({
      to: `/models/${m.id}`,
      icon: m.dashboard?.icon ?? m.icon ?? 'table',
      text: m.dashboard?.label ?? m.name,
      ...(m.dashboard?.roles && m.dashboard.roles.length > 0
        ? { roles: m.dashboard.roles }
        : {}),
    })
  }
  sections.push(['data', 'data', dataNav])

  if (toggles.commerce) {
    sections.push(['commerce', 'commerce', [
      { to: '/commerce/dashboard', icon: 'dashboard', text: 'Dashboard' },
      { to: '/commerce/pos', icon: 'cart', text: 'POS' },
      { to: '/commerce/customers', icon: 'user', text: 'Customers' },
      { to: '/commerce/orders', icon: 'orders', text: 'Orders' },
      { to: '/commerce/products', icon: 'package', text: 'Products' },
      { to: '/commerce/categories', icon: 'tags', text: 'Categories' },
      { to: '/commerce/manufacturers', icon: 'briefcase', text: 'Manufacturers' },
      { to: '/commerce/units', icon: 'list-number', text: 'Units' },
      { to: '/commerce/variants', icon: 'puzzle', text: 'Variants' },
      { to: '/commerce/reviews', icon: 'star', text: 'Reviews' },
      { to: '/commerce/coupons', icon: 'coupon', text: 'Coupons' },
      { to: '/commerce/gift-cards', icon: 'gift', text: 'Gift Cards' },
      { to: '/commerce/payments', icon: 'invoice', text: 'Payments' },
      { to: '/commerce/taxes', icon: 'percent', text: 'Taxes' },
      { to: '/commerce/printers/devices', icon: 'package', text: 'Printers' },
      { to: '/commerce/printers/receipts', icon: 'invoice', text: 'Receipts' },
      { to: '/commerce/waitlist/products', icon: 'clock', text: 'Product Waitlist' },
      { to: '/commerce/waitlist/restaurant', icon: 'clock', text: 'Restaurant Waitlist' },
      ...categoryNavItems(discoveredModels, 'commerce', new Set([
        'customer', 'order', 'product', 'product-variant', 'product-unit',
        'manufacturer', 'review', 'coupon', 'gift-card', 'payment', 'category',
        'cart', 'cart-item', 'order-item', 'tax-rate',
        'shipping-method', 'shipping-rate', 'shipping-zone',
        'delivery-route', 'driver', 'license-key', 'digital-delivery',
        'print-device', 'receipt',
        'waitlist-product', 'waitlist-restaurant',
      ])),
    ]])

    // Delivery section: routes/digital views ship under their full names
    // (`delivery-routes.stx`, `digital-delivery.stx`), the abbreviated
    // sidebar URLs from before never resolved.
    sections.push(['delivery', 'delivery', [
      { to: '/commerce/delivery', icon: 'truck', text: 'Overview' },
      { to: '/commerce/delivery/shipping-methods', icon: 'truck', text: 'Shipping Methods' },
      { to: '/commerce/delivery/shipping-rates', icon: 'percent', text: 'Shipping Rates' },
      { to: '/commerce/delivery/shipping-zones', icon: 'globe', text: 'Shipping Zones' },
      { to: '/commerce/delivery/drivers', icon: 'user', text: 'Drivers' },
      { to: '/commerce/delivery/delivery-routes', icon: 'globe', text: 'Routes' },
      { to: '/commerce/delivery/license-keys', icon: 'lock', text: 'License Keys' },
      { to: '/commerce/delivery/digital-delivery', icon: 'package', text: 'Digital Delivery' },
    ]])
  }

  if (toggles.marketing) {
    sections.push(['marketing', 'marketing', [
      { to: '/marketing/lists', icon: 'list-settings', text: 'Lists' },
      { to: '/marketing/social-posts', icon: 'clock', text: 'Social Posts' },
      { to: '/marketing/campaigns', icon: 'rocket', text: 'Campaigns' },
      { to: '/marketing/reviews', icon: 'star', text: 'Reviews' },
      ...categoryNavItems(discoveredModels, 'marketing', new Set(['campaign'])),
    ]])
  }

  // Analytics section: commerce/sales sub-pages live under
  // `analytics/commerce/{web,sales}.stx`. The bare `/analytics/commerce`
  // and `/analytics/sales` URLs from before never resolved. `/goals`
  // had no view file at all and is dropped.
  if (toggles.analytics) {
    sections.push(['analytics', 'analytics', [
      { to: '/analytics', icon: 'dashboard', text: 'Overview' },
      { to: '/analytics/web', icon: 'globe', text: 'Web' },
      { to: '/analytics/pages', icon: 'document', text: 'Top Pages' },
      { to: '/analytics/referrers', icon: 'link', text: 'Referrers' },
      { to: '/analytics/countries', icon: 'globe-search', text: 'Countries' },
      { to: '/analytics/devices', icon: 'package', text: 'Devices' },
      { to: '/analytics/browsers', icon: 'globe', text: 'Browsers' },
      { to: '/analytics/events', icon: 'bolt', text: 'Events' },
      { to: '/analytics/blog', icon: 'document', text: 'Blog' },
      { to: '/analytics/commerce/web', icon: 'cart', text: 'Commerce' },
      { to: '/analytics/commerce/sales', icon: 'sale-tag', text: 'Sales' },
      { to: '/analytics/marketing', icon: 'megaphone', text: 'Marketing' },
    ]])
  }

  // Management section: every page is at the root path; only
  // `permissions` lives under a `/management/` subdir. The bare
  // `/management/<x>` URLs from before never resolved.
  if (toggles.management) {
    const managementItems: NavItem[] = [
      { to: '/cloud', icon: 'cloud', text: 'Cloud' },
      { to: '/servers', icon: 'server', text: 'Servers' },
      { to: '/serverless', icon: 'zap', text: 'Serverless' },
      { to: '/dns', icon: 'globe-search', text: 'DNS' },
      { to: '/management/permissions', icon: 'lock', text: 'Permissions' },
      { to: '/mailboxes', icon: 'mailbox', text: 'Mailboxes' },
      { to: '/logs', icon: 'log', text: 'Logs' },
      { to: '/health', icon: 'activity', text: 'Health' },
      { to: '/insights', icon: 'star', text: 'Insights' },
      // Kanban surface (stacksjs/stacks#1846). Role-gated to admin and dev.
      // The layout's role map hides the row from client-role viewers.
      { to: '/kanban', icon: 'table', text: 'Kanban', roles: ['admin', 'dev'] },
    ]
    // CI tracking (stacksjs/stacks#1844) — opt-in via `ci.enabled` in
    // config/dashboard.ts. The page additionally checks `useRole().isDev()`
    // (stub for #1843) before rendering.
    if (toggles.ci)
      managementItems.push({ to: '/ci', icon: 'check-circle', text: 'CI' })
    sections.push(['management', 'management', managementItems])
  }

  // Utilities section: real paths are flat (`/buddy`, `/environment`,
  // `/access-tokens`) or under `/settings/*` for billing/mail. The
  // historical `/utilities/*` URLs were uniformly 404s.
  if (toggles.utilities) {
    sections.push(['utilities', 'utilities', [
      { to: '/buddy', icon: 'terminal', text: 'Buddy CLI' },
      { to: '/environment', icon: 'settings', text: 'Environment' },
      { to: '/access-tokens', icon: 'lock', text: 'Access Tokens' },
      { to: '/settings', icon: 'settings', text: 'Settings' },
      { to: '/settings/appearance', icon: 'paintbrush', text: 'Appearance' },
      { to: '/settings/mail', icon: 'mail', text: 'Mail Settings' },
    ]])
  }

  return sections
}

// ============================================================================
// macOS web sidebar (@stacksjs/components' <Sidebar theme="macos">)
// ============================================================================

/**
 * Navigation icon keys as SF-Symbol-style Iconify classes. The f7 icons
 * mirror SF Symbols for the macOS web sidebar.
 */
const NAV_ICON_CLASSES: Record<string, string> = {
  'home': 'i-f7-house',
  'function': 'i-f7-function',
  'list-number': 'i-f7-list-number',
  'package': 'i-f7-cube-box',
  'dashboard': 'i-f7-square-grid-2x2',
  'files': 'i-f7-folder',
  'file': 'i-f7-doc',
  'post': 'i-f7-doc-text',
  'tags': 'i-f7-tag',
  'tag': 'i-f7-tag',
  'comment': 'i-f7-chat-bubble',
  'user-edit': 'i-f7-person',
  'seo': 'i-f7-search',
  'rocket': 'i-f7-rocket',
  'api': 'i-f7-globe',
  'link': 'i-f7-link',
  'bolt': 'i-f7-bolt',
  'terminal': 'i-f7-chevron-left-slash-chevron-right',
  'queue': 'i-f7-list-bullet',
  'briefcase': 'i-f7-briefcase',
  'clock': 'i-f7-clock',
  'search': 'i-f7-search',
  'log': 'i-f7-doc-plaintext',
  'bell': 'i-f7-bell',
  'mail': 'i-f7-envelope',
  'mailbox': 'i-f7-tray',
  'activity': 'i-f7-waveform',
  'settings': 'i-f7-gear-alt',
  'paintbrush': 'i-f7-paintbrush',
  'users': 'i-f7-person-2',
  'user': 'i-f7-person',
  'group': 'i-f7-person-3',
  'table': 'i-f7-table',
  'cart': 'i-f7-cart',
  'check-circle': 'i-f7-checkmark-circle',
  'cloud': 'i-f7-cloud',
  'coupon': 'i-f7-ticket',
  'document': 'i-f7-doc-text',
  'gift': 'i-f7-gift',
  'globe': 'i-f7-globe',
  'globe-search': 'i-f7-globe',
  'invoice': 'i-f7-money-dollar-circle',
  'lock': 'i-f7-lock',
  'list-settings': 'i-f7-list-bullet-below-rectangle',
  'megaphone': 'i-f7-speaker-2',
  'orders': 'i-f7-bag',
  'percent': 'i-f7-percent',
  'puzzle': 'i-f7-square-on-square',
  'sale-tag': 'i-f7-tag',
  'server': 'i-f7-rectangle-stack',
  'star': 'i-f7-star',
  'truck': 'i-f7-car-fill',
  'zap': 'i-f7-bolt',
}

/** One row for `@stacksjs/components`' <Sidebar :sections>. */
export interface WebSidebarItem {
  id: string
  label: string
  icon: string
  /** macOS system color name or CSS color for the icon tint. */
  iconColor: string
  href: string
  roles?: string[]
}

export interface WebSidebarSection {
  id: string
  label: string
  items: WebSidebarItem[]
}

/** Stable row id derived from the route (e.g. `/content/posts` → `content-posts`). */
function navItemId(to: string): string {
  return to.replace(/^\//, '').replace(/\//g, '-') || 'home'
}

function titleCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * The dashboard navigation shaped for the macOS web sidebar. Reads the
 * discovered-models manifest synchronously (stx server-script friendly)
 * and applies the shared section and toggle logic.
 */
export function buildWebSidebarSections(): WebSidebarSection[] {
  const manifest = loadDiscoveredManifest()
  const sections = buildNavSections(manifest.models, manifest.sections)

  return [
    {
      id: 'top',
      label: '',
      items: [{ id: 'home', label: 'Home', icon: NAV_ICON_CLASSES.home, iconColor: 'blue', href: '/' }],
    },
    ...sections.map(([key, label, items]) => ({
      id: key,
      label: titleCase(label),
      items: items.map(item => ({
        id: navItemId(item.to),
        label: item.text,
        icon: NAV_ICON_CLASSES[item.icon] ?? NAV_ICON_CLASSES.file,
        iconColor: 'blue',
        href: item.to,
        ...(item.roles && item.roles.length > 0 ? { roles: item.roles } : {}),
      })),
    })),
    {
      id: 'system',
      label: '',
      items: [{ id: 'settings', label: 'Settings', icon: NAV_ICON_CLASSES.settings, iconColor: 'blue', href: '/settings' }],
    },
  ]
}
