import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'AccessTokenIndexAction',
  description: 'Returns access token data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when AccessToken model is available
    const tokens = [
      { name: 'Production API', token: 'sk_live_••••••••4a2b', lastUsed: '2m ago', created: '2024-01-01', scopes: ['read', 'write'], status: 'active' },
      { name: 'CI/CD Pipeline', token: 'sk_live_••••••••8c3d', lastUsed: '1h ago', created: '2024-01-10', scopes: ['deploy'], status: 'active' },
      { name: 'Mobile App', token: 'sk_live_••••••••2e4f', lastUsed: '5m ago', created: '2024-01-15', scopes: ['read'], status: 'active' },
      { name: 'Development', token: 'sk_test_••••••••6g8h', lastUsed: '10m ago', created: '2024-01-18', scopes: ['read', 'write'], status: 'active' },
      { name: 'Old Integration', token: 'sk_live_••••••••0i1j', lastUsed: '30d ago', created: '2023-06-01', scopes: ['read'], status: 'expired' },
    ]

    const stats = [
      { label: 'Active Tokens', value: '4' },
      { label: 'API Calls (24h)', value: '45.2K' },
      { label: 'Rate Limit', value: '1000/min' },
      { label: 'Expired', value: '1' },
    ]

    const scopes = [
      { name: 'read', description: 'Read access to resources' },
      { name: 'write', description: 'Write access to resources' },
      { name: 'delete', description: 'Delete access to resources' },
      { name: 'deploy', description: 'Deploy applications' },
      { name: 'admin', description: 'Full administrative access' },
    ]

    return { tokens, stats, scopes }
  },
})
