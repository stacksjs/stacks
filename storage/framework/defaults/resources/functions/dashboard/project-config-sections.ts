export interface ProjectConfigFile {
  name: string
  title: string
}

export const projectConfigSections = [
  { id: 'general', label: 'General', icon: 'i-f7-gear-alt-fill', tone: 'grey', description: 'Project identity, URLs, language, and framework extensions.', files: ['app', 'sites', 'stacks', 'feature-flags'] },
  { id: 'data', label: 'Database & Storage', icon: 'i-f7-tray-2-fill', tone: 'blue', description: 'Database connections, query behavior, and storage disks.', files: ['database', 'query-builder', 'qb', 'filesystems', 'storage'] },
  { id: 'security', label: 'Auth & Security', icon: 'i-f7-lock-shield-fill', tone: 'purple', description: 'Authentication, access, password hashing, and security policies.', files: ['auth', 'security', 'hashing', 'team'] },
  { id: 'network', label: 'Server & Networking', icon: 'i-f7-antenna-radiowaves-left-right', tone: 'blue', description: 'Server behavior, local ports, cross-origin requests, and realtime connections.', files: ['server', 'ports', 'cors', 'realtime', 'http'] },
  { id: 'cloud', label: 'Cloud & Domains', icon: 'i-f7-cloud-fill', tone: 'blue', description: 'Hosting, deployments, domains, and remote hosts.', files: ['cloud', 'domains', 'remote', 'deploy'] },
  { id: 'dns', label: 'DNS Records', icon: 'i-f7-globe', tone: 'blue', description: 'Declare the verification, mail, and alias records this project publishes on deploy.', files: ['dns'] },
  { id: 'jobs', label: 'Jobs & Cache', icon: 'i-f7-clock-fill', tone: 'grey', description: 'Job queues, schedules, cache stores, and background processing.', files: ['queue', 'cache', 'scheduler', 'cron', 'jobs'] },
  { id: 'interface', label: 'UI & Desktop', icon: 'i-f7-desktopcomputer', tone: 'purple', description: 'STX rendering, CSS, dashboard navigation, and native app options.', files: ['dashboard', 'ui', 'css', 'desktop', 'mobile', 'images'] },
  { id: 'messaging', label: 'Email & Messaging', icon: 'i-f7-envelope-fill', tone: 'blue', description: 'Project defaults for email, notifications, SMS, and social providers.', files: ['email', 'notification', 'sms', 'phone', 'socials'] },
  { id: 'monitoring', label: 'Analytics & Logs', icon: 'i-f7-chart-bar-fill', tone: 'green', description: 'Analytics, logging, error reporting, and application monitoring.', files: ['analytics', 'logging', 'errors', 'monitoring', 'telemetry'] },
  { id: 'content', label: 'Content & Search', icon: 'i-f7-doc-text-fill', tone: 'grey', description: 'Content, documentation, forms, and search indexes.', files: ['blog', 'cms', 'docs', 'search-engine', 'forms'] },
  { id: 'commerce', label: 'Commerce & Growth', icon: 'i-f7-cart-fill', tone: 'green', description: 'Commerce, payments, subscriptions, and marketing.', files: ['commerce', 'payment', 'saas', 'marketing'] },
  { id: 'integrations', label: 'AI & Integrations', icon: 'i-f7-bolt-fill', tone: 'purple', description: 'AI providers, external services, and shared packages.', files: ['ai', 'services', 'library'] },
  { id: 'development', label: 'Developer Tools', icon: 'i-f7-hammer-fill', tone: 'grey', description: 'Buddy, dependencies, Git, linting, and code style.', files: ['cli', 'deps', 'git', 'commit', 'changelog', 'buddy-bot', 'code-style', 'lint'] },
  { id: 'environment-schema', label: 'Environment Schema', icon: 'i-f7-list-bullet', tone: 'purple', description: 'Declare environment variable types, defaults, and validation rules.', files: ['env'] },
  { id: 'custom', label: 'Custom Configuration', icon: 'i-f7-folder-fill', tone: 'grey', description: 'Configuration files added by this project.', files: [] },
] as const

export type ProjectConfigSection = typeof projectConfigSections[number]['id']

export function projectConfigSection(id: string): typeof projectConfigSections[number] | undefined {
  return projectConfigSections.find(section => section.id === id)
}

const configSectionByFile = new Map<string, ProjectConfigSection>(
  projectConfigSections.flatMap(section => section.files.map(file => [file, section.id])),
)

export function sectionForConfig(file: string): ProjectConfigSection {
  return configSectionByFile.get(file) ?? 'custom'
}

export function projectConfigHref(section: ProjectConfigSection, file?: string): string {
  const path = section === 'general' ? '/settings' : `/settings/config/${section}`
  return file ? `${path}?file=${encodeURIComponent(file)}` : path
}

const labelOverrides: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  aws: 'AWS',
  cli: 'CLI',
  cms: 'CMS',
  cors: 'CORS',
  cpu: 'CPU',
  css: 'CSS',
  db: 'DB',
  dns: 'DNS',
  dsn: 'DSN',
  html: 'HTML',
  http: 'HTTP',
  https: 'HTTPS',
  id: 'ID',
  ip: 'IP',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  json: 'JSON',
  mysql: 'MySQL',
  oauth: 'OAuth',
  seo: 'SEO',
  ses: 'SES',
  singlestore: 'SingleStore',
  sms: 'SMS',
  smtp: 'SMTP',
  sql: 'SQL',
  sqlite: 'SQLite',
  timezone: 'Time Zone',
  ssl: 'SSL',
  tls: 'TLS',
  ttl: 'TTL',
  ui: 'UI',
  url: 'URL',
  urls: 'URLs',
  uuid: 'UUID',
  webhook: 'Webhook',
}

export function configLabel(key: string): string {
  return key.replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[_.\s-]+/)
    .filter(Boolean)
    .map(word => Object.hasOwn(labelOverrides, word.toLowerCase()) ? labelOverrides[word.toLowerCase()] : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || key
}

const fileLabels = new Map([
  ['app', 'Application'],
  ['cli', 'Buddy CLI'],
  ['css', 'Stylesheets'],
  ['deps', 'Dependencies'],
  ['env', 'Variable Definitions'],
  ['qb', 'Query Builder Alias'],
  ['stacks', 'Stack Extensions'],
])

export function configFileLabel(file: string): string {
  return fileLabels.get(file) ?? file.split('/').map(configLabel).join(' › ')
}
