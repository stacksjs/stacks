import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PermissionIndexAction',
  description: 'Returns roles and permissions data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      roles: [
        { id: 1, name: 'Admin', description: 'Full access to all resources', userCount: 2, permissions: ['*'] },
        { id: 2, name: 'Editor', description: 'Can manage content and media', userCount: 5, permissions: ['content:*', 'media:*'] },
        { id: 3, name: 'User', description: 'Basic access', userCount: 1240, permissions: ['profile:read', 'profile:update'] },
      ],
      permissions: [
        { name: 'content:create', description: 'Create content' },
        { name: 'content:read', description: 'Read content' },
        { name: 'content:update', description: 'Update content' },
        { name: 'content:delete', description: 'Delete content' },
        { name: 'users:manage', description: 'Manage users' },
        { name: 'settings:manage', description: 'Manage settings' },
      ],
    }
  },
})
