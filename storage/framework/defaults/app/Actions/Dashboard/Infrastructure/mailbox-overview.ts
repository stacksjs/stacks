type DataRecord = Record<string, unknown>

export interface DashboardMailbox {
  id: string
  email: string
  username: string
  status: 'configured'
}

export interface DashboardMailboxDomain {
  domain: string
  subdomain: string | null
  status: 'configured'
}

export interface DashboardMailboxFeature {
  name: string
  enabled: boolean
}

export interface DashboardMailboxPort {
  name: string
  port: number
}

export interface DashboardMailboxStorage {
  name: string
  value: string
}

export interface DashboardMailboxForward {
  source: string
  destinations: string[]
}

export interface DashboardMailboxSnapshot {
  mailboxes: DashboardMailbox[]
  domains: DashboardMailboxDomain[]
  from: {
    name: string | null
    address: string | null
  }
  server: {
    enabled: boolean
    mode: string | null
    scan: boolean
    features: DashboardMailboxFeature[]
    ports: DashboardMailboxPort[]
    storage: DashboardMailboxStorage[]
  }
  forwards: DashboardMailboxForward[]
  generatedAt: string
}

function record(value: unknown): DataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DataRecord
    : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function mailboxAddress(value: string, domain: string | null): string {
  return value.includes('@') || !domain ? value : `${value}@${domain}`
}

function configuredMailboxes(emailConfig: DataRecord, domain: string | null): DashboardMailbox[] {
  if (!Array.isArray(emailConfig.mailboxes))
    return []

  return emailConfig.mailboxes.flatMap((entry, index) => {
    const rawEmail = typeof entry === 'string'
      ? text(entry)
      : text(record(entry).email)
    if (!rawEmail)
      return []
    const email = mailboxAddress(rawEmail, domain)
    return [{
      id: `mailbox:${index}`,
      email,
      username: email.split('@')[0] || email,
      status: 'configured' as const,
    }]
  })
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string')
    return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return null
}

export function getDashboardMailboxSnapshot(
  value: unknown,
  now: () => Date = () => new Date(),
): DashboardMailboxSnapshot {
  const emailConfig = record(value)
  const server = record(emailConfig.server)
  const domain = text(emailConfig.domain)
  const subdomain = text(server.subdomain)
  const from = record(emailConfig.from)
  const features = record(server.features)
  const ports = record(server.ports)
  const storage = record(server.storage)
  const forwards = record(emailConfig.forwards)

  return {
    mailboxes: configuredMailboxes(emailConfig, domain),
    domains: domain
      ? [{
          domain,
          subdomain: subdomain ? `${subdomain}.${domain}` : null,
          status: 'configured',
        }]
      : [],
    from: {
      name: text(from.name),
      address: text(from.address),
    },
    server: {
      enabled: server.enabled === true,
      mode: text(server.mode),
      scan: server.scan === true,
      features: Object.entries(features)
        .filter(([, enabled]) => typeof enabled === 'boolean')
        .map(([name, enabled]) => ({ name, enabled: enabled === true })),
      ports: Object.entries(ports)
        .filter(([, port]) => typeof port === 'number' && Number.isFinite(port))
        .map(([name, port]) => ({ name, port: port as number })),
      storage: Object.entries(storage)
        .map(([name, storageValue]) => {
          const normalized = stringValue(storageValue)
          return normalized === null ? null : { name, value: normalized }
        })
        .filter((item): item is DashboardMailboxStorage => item !== null),
    },
    forwards: Object.entries(forwards)
      .map(([source, destinations]) => ({
        source,
        destinations: Array.isArray(destinations)
          ? destinations.map(text).filter((destination): destination is string => Boolean(destination))
          : [],
      })),
    generatedAt: now().toISOString(),
  }
}
