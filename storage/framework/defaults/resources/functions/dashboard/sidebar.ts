/**
 * Dashboard sidebar nav HTML builder.
 *
 * Generates the entire navigation tree (8 sections + each leaf item's
 * inline SVG icon + a dynamic row per user-defined model) as a single
 * HTML string. The layout's `<script server>` calls this and passes
 * the result to `<Sidebar :nav-html="…" />`, where it's rendered as
 * raw HTML (`{{{ navHtml }}}`).
 *
 * Why this lives in the layout-side rather than inside Sidebar.stx:
 * STX's @foreach evaluator in the Sidebar component template does NOT
 * resolve identifiers from the component's own `<script>` block, from
 * defineProps defaults, or from prop bindings reliably (it fails with
 * "not iterable" or "unexpected token" depending on the source). A
 * static HTML string passed as a prop and rendered via the triple-brace
 * raw interpolation IS reliable in every context, so we sidestep the
 * scope problem entirely by building the markup here on the server
 * side.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface DiscoveredModel {
  id: string
  name: string
  icon?: string
  hasDedicatedPage?: boolean
}

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
const SVG_CLOSE = '</svg>'

// Path data for each icon used by the sidebar. Keys are short logical
// names; the leaf-item builder below uses these directly. All icons are
// 20×20, stroke-based, currentColor — restyle by changing one CSS rule
// rather than editing each path.
const ICON_PATHS: Record<string, string> = {
  'home': '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2"/>',
  'puzzle': '<path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1H3a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>',
  'function': '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
  'list-number': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'package': '<path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  'dashboard': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/>',
  'files': '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>',
  'file': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  'post': '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  'tags': '<path d="M7 7h.01M2 12.5l9.1 9.1a1.5 1.5 0 002.1 0l7.3-7.3a1.5 1.5 0 000-2.1L11.4 3H4a1 1 0 00-1 1v7.4a1.5 1.5 0 00.4 1z"/>',
  'tag': '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  'comment': '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  'user-edit': '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  'seo': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M11 8v6M8 11h6"/>',
  'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3"/>',
  'api': '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  'link': '<path d="M15 7h3a5 5 0 010 10h-3m-6 0H6A5 5 0 016 7h3"/><line x1="8" y1="12" x2="16" y2="12"/>',
  'bolt': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  'queue': '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
  'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'bell': '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  'cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
  'user': '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'orders': '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
  'coupon': '<path d="M2 9a3 3 0 003 3v4a2 2 0 002 2h14a2 2 0 002-2v-4a3 3 0 000-6V8a2 2 0 00-2-2H7a2 2 0 00-2 2v1a3 3 0 00-3 3z"/><path d="M13 9v2M13 13h.01"/>',
  'gift': '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>',
  'invoice': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  'truck': '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  'percent': '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  'users': '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  'group': '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  'mail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  'table': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  'list-settings': '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="4" cy="18" r="2"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  'document': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'sale-tag': '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/><line x1="10" y1="14" x2="14" y2="10"/>',
  'megaphone': '<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>',
  'cloud': '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>',
  'server': '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'globe-search': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10M12 2a15.3 15.3 0 00-4 10 15.3 15.3 0 004 10"/>',
  'lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  'mailbox': '<path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zm0 0V9a3 3 0 00-3-3H5a3 3 0 00-3 3v8"/><path d="M6 6v11"/><path d="M2 12h4"/>',
  'log': '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
}

function svg(key: string): string {
  const path = ICON_PATHS[key] ?? ICON_PATHS.file
  return SVG_OPEN + path + SVG_CLOSE
}

interface NavItem { to: string, icon: string, text: string, mpa?: boolean }

const SECTION_TOGGLE_ONCLICK = "(function(btn){var sec=btn.closest('.sidebar-section');var key=sec.getAttribute('data-section');sec.classList.toggle('collapsed');try{var c={};var s=localStorage.getItem('sidebar-collapsed');if(s)c=JSON.parse(s);c[key]=sec.classList.contains('collapsed');localStorage.setItem('sidebar-collapsed',JSON.stringify(c));}catch(e){}})(this)"

function renderItem(item: NavItem): string {
  const mpaAttr = item.mpa ? ' data-mpa="true"' : ''
  return `<li><a href="${item.to}" class="sidebar-link"${mpaAttr}><span class="sidebar-icon">${svg(item.icon)}</span><span>${item.text}</span></a></li>`
}

function renderSection(key: string, label: string, items: NavItem[]): string {
  if (items.length === 0) return ''
  const lis = items.map(renderItem).join('')
  return `<div class="sidebar-section" data-section="${key}">`
    + `<button class="sidebar-section-label" type="button" onclick="${SECTION_TOGGLE_ONCLICK}"><span>${label}</span><div class="sidebar-chevron"></div></button>`
    + `<ul class="sidebar-section-list">${lis}</ul>`
    + '</div>'
}

/**
 * Pull the discovered-models manifest from the framework defaults dir.
 * Returns [] when the file is absent (e.g. on a fresh project before
 * the first dashboard run regenerates it). Sorted by name so the order
 * is stable across rebuilds.
 */
export function loadDiscoveredModels(): DiscoveredModel[] {
  const manifestPath = resolve(process.cwd(), 'storage/framework/defaults/views/dashboard/.discovered-models.json')
  if (!existsSync(manifestPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as DiscoveredModel[]
    return Array.isArray(parsed) ? parsed.sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []
  }
  catch {
    return []
  }
}

/**
 * Build the entire sidebar nav HTML. Pass any discoveredModels you want
 * surfaced as a separate "Models" section — by convention we filter to
 * those that don't already have a dedicated page in the static nav.
 */
export function buildSidebarNavHtml(discoveredModels: DiscoveredModel[] = []): string {
  const sections: Array<[string, string, NavItem[]]> = [
    ['library', 'library', [
      { to: '/components', icon: 'puzzle', text: 'Components' },
      { to: '/functions', icon: 'function', text: 'Functions' },
      { to: '/releases', icon: 'list-number', text: 'Releases' },
      { to: '/packages', icon: 'package', text: 'Packages' },
    ]],
    ['content', 'content', [
      { to: '/content/dashboard', icon: 'dashboard', text: 'Dashboard' },
      { to: '/content/files', icon: 'files', text: 'Files' },
      { to: '/content/pages', icon: 'file', text: 'Pages' },
      { to: '/content/posts', icon: 'post', text: 'Posts' },
      { to: '/content/categories', icon: 'tags', text: 'Categories' },
      { to: '/content/tags', icon: 'tag', text: 'Tags' },
      { to: '/content/comments', icon: 'comment', text: 'Comments' },
      { to: '/content/authors', icon: 'user-edit', text: 'Authors' },
      { to: '/content/seo', icon: 'seo', text: 'SEO' },
    ]],
    ['app', 'app', [
      { to: '/deployments', icon: 'rocket', text: 'Deployments' },
      { to: '/requests', icon: 'api', text: 'Requests' },
      { to: '/realtime', icon: 'link', text: 'Realtime' },
      { to: '/actions', icon: 'bolt', text: 'Actions' },
      { to: '/commands', icon: 'terminal', text: 'Commands' },
      { to: '/queue', icon: 'queue', text: 'Queue' },
      { to: '/jobs', icon: 'briefcase', text: 'Jobs' },
      { to: '/queries', icon: 'search', text: 'Queries' },
      { to: '/notifications/dashboard', icon: 'bell', text: 'Notifications' },
    ]],
    ['data', 'data', [
      { to: '/data/dashboard', icon: 'dashboard', text: 'Dashboard' },
      { to: '/data/activity', icon: 'activity', text: 'Activity' },
      { to: '/data/users', icon: 'users', text: 'Users' },
      { to: '/data/teams', icon: 'group', text: 'Teams' },
      { to: '/data/subscribers', icon: 'mail', text: 'Subscribers' },
      // Each user-defined model without a dedicated page gets a row
      // here so the dashboard exposes an entry point even before a
      // bespoke page is hand-built. The mpa flag tells the SPA router
      // to do a full page load (the model viewer is its own bundle).
      ...discoveredModels
        .filter(m => !m.hasDedicatedPage)
        .map((m): NavItem => ({ to: `/data/${m.id}`, icon: 'table', text: m.name, mpa: true })),
    ]],
    ['commerce', 'commerce', [
      { to: '/commerce/dashboard', icon: 'dashboard', text: 'Dashboard' },
      { to: '/commerce/pos', icon: 'cart', text: 'POS' },
      { to: '/commerce/customers', icon: 'user', text: 'Customers' },
      { to: '/commerce/orders', icon: 'orders', text: 'Orders' },
      { to: '/commerce/products', icon: 'package', text: 'Products' },
      { to: '/commerce/coupons', icon: 'coupon', text: 'Coupons' },
      { to: '/commerce/gift-cards', icon: 'gift', text: 'Gift Cards' },
      { to: '/commerce/payments', icon: 'invoice', text: 'Payments' },
      { to: '/commerce/delivery', icon: 'truck', text: 'Delivery' },
      { to: '/commerce/taxes', icon: 'percent', text: 'Taxes' },
    ]],
    ['marketing', 'marketing', [
      { to: '/marketing/lists', icon: 'list-settings', text: 'Lists' },
      { to: '/marketing/social-posts', icon: 'clock', text: 'Social Posts' },
      { to: '/marketing/campaigns', icon: 'rocket', text: 'Campaigns' },
      { to: '/marketing/reviews', icon: 'star', text: 'Reviews' },
    ]],
    ['analytics', 'analytics', [
      { to: '/analytics/web', icon: 'globe', text: 'Web' },
      { to: '/analytics/blog', icon: 'document', text: 'Blog' },
      { to: '/analytics/events', icon: 'target', text: 'Goals' },
      { to: '/analytics/commerce/web', icon: 'cart', text: 'Commerce' },
      { to: '/analytics/commerce/sales', icon: 'sale-tag', text: 'Sales' },
      { to: '/analytics/marketing', icon: 'megaphone', text: 'Marketing' },
    ]],
    ['management', 'management', [
      { to: '/cloud', icon: 'cloud', text: 'Cloud' },
      { to: '/servers', icon: 'server', text: 'Servers' },
      { to: '/serverless', icon: 'zap', text: 'Serverless' },
      { to: '/dns', icon: 'globe-search', text: 'DNS' },
      { to: '/management/permissions', icon: 'lock', text: 'Permissions' },
      { to: '/mailboxes', icon: 'mailbox', text: 'Mailboxes' },
      { to: '/logs', icon: 'log', text: 'Logs' },
    ]],
  ]

  return sections.map(([key, label, items]) => renderSection(key, label, items)).join('')
}

/**
 * Build all three pre-rendered chunks the Sidebar component consumes,
 * in one call. Returned with intentionally-uncommon keys (`top`, `nav`,
 * `bottom`) so they don't collide with auto-imported names that STX's
 * global-scope auto-imports may surface in the component template's
 * lookup chain — that collision was the cause of the previous bug
 * where the rendered output dumped the function source text instead
 * of its return value.
 */
export function buildSidebarChunks(): { top: string, nav: string, bottom: string } {
  return {
    top: `<a href="/" class="sidebar-link sidebar-link-home"><span class="sidebar-icon">${svg('home')}</span><span>Home</span></a>`,
    nav: buildSidebarNavHtml(loadDiscoveredModels()),
    bottom: `<a href="/settings/ai" class="sidebar-link"><span class="sidebar-icon">${svg('settings')}</span><span>Settings</span></a>`,
  }
}
