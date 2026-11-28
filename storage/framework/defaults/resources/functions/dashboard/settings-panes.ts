import { projectConfigSection } from './project-config-sections'

export const settingsPanes = [
  { id: 'environment', label: 'Variables', href: '/settings/environment', icon: 'i-f7-gear', tone: 'grey', description: '', group: 'environment', keywords: 'environment env dotenv secrets variables bindings' },
  { id: 'appearance', label: 'Appearance', href: '/settings/appearance', icon: 'i-f7-circle-lefthalf-fill', tone: 'purple', description: 'Choose how the dashboard looks and which sections are shown in the sidebar.', group: 'dashboard', keywords: 'theme color mode dark light sidebar display' },
  { id: 'software-update', label: 'Software Update', href: '/settings/software-update', icon: 'i-f7-arrow-down-circle-fill', tone: 'blue', description: 'Check for Stacks releases and update your projects through Buddy.', group: 'dashboard', keywords: 'upgrade framework version install dependencies' },
  { id: 'mail', label: 'Mail Delivery', href: '/settings/mail', icon: 'i-f7-paperplane-fill', tone: 'blue', description: 'Set the sender, delivery driver, and credentials for outgoing mail.', group: 'dashboard', keywords: 'email smtp sender transport' },
  { id: 'billing', label: 'Billing', href: '/settings/billing', icon: 'i-f7-creditcard-fill', tone: 'green', description: 'View your subscription, payment methods, and transactions.', group: 'dashboard', keywords: 'subscription payment transaction invoice' },
] as const

export function settingsPanePath(href: string): string {
  return href.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/settings'
}

export function settingsPaneLabel(href: string): string {
  const pathname = settingsPanePath(href)
  if (pathname === '/settings/environment')
    return 'Environment Variables'
  const pane = settingsPanes.find(item => item.href === pathname)
  if (pane)
    return pane.label
  if (pathname === '/settings')
    return 'General'
  const prefix = '/settings/config/'
  return (pathname.startsWith(prefix) && projectConfigSection(pathname.slice(prefix.length))?.label) || 'Settings'
}
