import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'

export default new Action({
  name: 'MailboxIndexAction',
  description: 'Returns mailbox configuration from config files.',
  method: 'GET',
  async handle() {
    try {
      const emailConfig = config.email || {}

      const domain = (emailConfig as any).domain || 'stacksjs.com'
      const rawMailboxes = (emailConfig as any).mailboxes || []
      const serverConfig = (emailConfig as any).server || {}
      const fromConfig = (emailConfig as any).from || {}

      // Build mailbox list from config/email.ts mailboxes array
      const mailboxes = rawMailboxes.map((entry: string | Record<string, unknown>) => {
        if (typeof entry === 'string') {
          return {
            email: entry.includes('@') ? entry : `${entry}@${domain}`,
            username: entry.includes('@') ? entry.split('@')[0] : entry,
            status: 'configured',
          }
        }

        // Object format: { email: 'chris', password: '...' }
        const email = typeof entry.email === 'string'
          ? (entry.email.includes('@') ? entry.email : `${entry.email}@${domain}`)
          : ''
        return {
          email,
          username: email.split('@')[0] || '',
          status: 'configured',
        }
      })

      // Read server features
      const features = serverConfig.features || {}
      const featureList = Object.entries(features)
        .map(([name, enabled]) => ({ name, enabled: Boolean(enabled) }))

      // Read server ports
      const ports = serverConfig.ports || {}

      // Read server mode and settings
      const mode = serverConfig.mode || 'server'
      const scan = serverConfig.scan ?? false
      const subdomain = serverConfig.subdomain || 'mail'

      // Build domain info
      const domains = [{
        domain,
        mailboxes: mailboxes.length,
        status: 'configured',
        subdomain: `${subdomain}.${domain}`,
      }]

      const stats = [
        { label: 'Mailboxes', value: String(mailboxes.length) },
        { label: 'Server Mode', value: mode },
        { label: 'Domain', value: domain },
        { label: 'Features', value: String(featureList.filter(f => f.enabled).length) },
      ]

      return {
        mailboxes,
        from: fromConfig,
        server: {
          mode,
          scan,
          subdomain,
          features: featureList,
          ports,
          storage: serverConfig.storage || {},
        },
        domains,
        stats,
      }
    }
    catch {
      return { mailboxes: [], domains: [], stats: [] }
    }
  },
})
