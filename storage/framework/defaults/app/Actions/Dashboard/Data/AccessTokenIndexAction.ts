import { Action } from '@stacksjs/actions'

// TODO: create a PersonalAccessToken model and use ORM queries instead of raw SQL
export default new Action({
  name: 'AccessTokenIndexAction',
  description: 'Returns access token data for the dashboard.',
  method: 'GET',
  async handle() {
    let tokens: Array<{ name: string, token: string, lastUsed: string, created: string, scopes: string[], status: string }> = []

    let stats = [
      { label: 'Active Tokens', value: '0' },
      { label: 'API Calls (24h)', value: '-' },
      { label: 'Rate Limit', value: '1000/min' },
      { label: 'Expired', value: '0' },
    ]

    const scopes = [
      { name: 'read', description: 'Read access to resources' },
      { name: 'write', description: 'Write access to resources' },
      { name: 'delete', description: 'Delete access to resources' },
      { name: 'deploy', description: 'Deploy applications' },
      { name: 'admin', description: 'Full administrative access' },
    ]

    try {
      const { Database } = await import('bun:sqlite')
      const { resolve } = await import('node:path')
      const db = new Database(resolve(process.cwd(), 'database/stacks.sqlite'), { readonly: true })
      const rows = db.query('SELECT * FROM personal_access_tokens ORDER BY id DESC LIMIT 50').all() as Array<Record<string, unknown>>

      if (rows.length > 0) {
        tokens = rows.map((r) => {
          const tokenStr = r.token ? `${String(r.token).substring(0, 8)}........${String(r.token).substring(String(r.token).length - 4)}` : '........'
          let abilities: string[] = []
          try { abilities = JSON.parse(String(r.abilities || '[]')) }
          catch { abilities = ['read'] }
          return {
            name: String(r.name || ''),
            token: tokenStr,
            lastUsed: String(r.last_used_at || '-'),
            created: String(r.created_at || ''),
            scopes: abilities,
            status: r.expires_at && new Date(String(r.expires_at)) < new Date() ? 'expired' : 'active',
          }
        })
        const activeCount = tokens.filter(t => t.status === 'active').length
        const expiredCount = tokens.filter(t => t.status === 'expired').length
        stats = [
          { label: 'Active Tokens', value: String(activeCount) },
          { label: 'API Calls (24h)', value: '-' },
          { label: 'Rate Limit', value: '1000/min' },
          { label: 'Expired', value: String(expiredCount) },
        ]
      }

      db.close()
    }
    catch {
      // keep fallback data
    }

    return { tokens, stats, scopes }
  },
})
