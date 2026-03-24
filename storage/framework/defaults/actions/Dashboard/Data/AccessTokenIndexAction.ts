import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'AccessTokenIndexAction',
  description: 'Returns access token data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'API Token', token: '***...abc123', abilities: ['read', 'write'], lastUsed: '2 hours ago', expiresAt: '2025-12-31', createdAt: '2024-01-15' },
        { id: 2, name: 'CI/CD Token', token: '***...def456', abilities: ['deploy'], lastUsed: '1 day ago', expiresAt: '2025-06-30', createdAt: '2024-03-01' },
      ],
    }
  },
})
