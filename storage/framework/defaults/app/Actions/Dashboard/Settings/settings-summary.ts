export interface DashboardSettingsConfig {
  app?: {
    name?: unknown
    url?: unknown
    timezone?: unknown
    locale?: unknown
  }
  auth?: {
    enabled?: unknown
    tokenExpiry?: unknown
  }
  security?: {
    firewall?: {
      enabled?: unknown
      ipAddresses?: unknown
    }
  }
  email?: {
    notifications?: {
      newEmail?: unknown
      bounces?: unknown
      complaints?: unknown
    }
  }
  services?: {
    aws?: Record<string, unknown>
    github?: Record<string, unknown>
    sendgrid?: Record<string, unknown>
    slack?: Record<string, unknown>
    stripe?: Record<string, unknown>
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isConfigured(...values: unknown[]): boolean {
  return values.some(value => text(value).trim().length > 0)
}

function integration(
  name: string,
  icon: string,
  configured: boolean,
): { name: string, status: 'configured' | 'not_configured', icon: string } {
  return {
    name,
    status: configured ? 'configured' : 'not_configured',
    icon,
  }
}

export function buildDashboardSettings(config: DashboardSettingsConfig) {
  const app = config.app || {}
  const auth = config.auth || {}
  const firewall = config.security?.firewall || {}
  const emailNotifications = config.email?.notifications || {}
  const services = config.services || {}

  const generalSettings = [
    { key: 'Site Name', value: text(app.name), type: 'text' },
    { key: 'Site URL', value: text(app.url), type: 'text' },
    { key: 'Timezone', value: text(app.timezone), type: 'text' },
    { key: 'Language', value: text(app.locale), type: 'text' },
  ]

  const securitySettings = [
    { key: 'Authentication', value: auth.enabled === true, type: 'toggle' },
    {
      key: 'Access Token Expiry',
      value: typeof auth.tokenExpiry === 'number' ? auth.tokenExpiry : null,
      type: 'milliseconds',
    },
    { key: 'Firewall', value: firewall.enabled === true, type: 'toggle' },
    {
      key: 'IP Whitelist Entries',
      value: Array.isArray(firewall.ipAddresses) ? firewall.ipAddresses.length : 0,
      type: 'number',
    },
  ]

  const notificationSettings = [
    { key: 'New Email Notifications', value: emailNotifications.newEmail === true, type: 'toggle' },
    { key: 'Bounce Notifications', value: emailNotifications.bounces === true, type: 'toggle' },
    { key: 'Complaint Notifications', value: emailNotifications.complaints === true, type: 'toggle' },
  ]

  const integrations = [
    integration(
      'Stripe',
      'i-hugeicons-credit-card',
      isConfigured(services.stripe?.secretKey, services.stripe?.publicKey),
    ),
    integration(
      'SendGrid',
      'i-hugeicons-mail-01',
      isConfigured(services.sendgrid?.apiKey),
    ),
    integration(
      'Amazon Web Services',
      'i-hugeicons-cloud',
      isConfigured(services.aws?.appId, services.aws?.apiKey),
    ),
    integration(
      'GitHub',
      'i-hugeicons-github',
      isConfigured(services.github?.clientId, services.github?.clientSecret),
    ),
    integration(
      'Slack',
      'i-hugeicons-bubble-chat',
      isConfigured(services.slack?.webhookUrl, services.slack?.botToken),
    ),
  ]

  return { generalSettings, securitySettings, notificationSettings, integrations }
}
