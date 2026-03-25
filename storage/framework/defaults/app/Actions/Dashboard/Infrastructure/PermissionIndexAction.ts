import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PermissionIndexAction',
  description: 'Returns roles and permissions data for the dashboard.',
  method: 'GET',
  async handle() {
    const roles = [
      { name: 'Admin', users: 3, permissions: 'Full access', description: 'Complete system access' },
      { name: 'Editor', users: 8, permissions: '24 permissions', description: 'Content management' },
      { name: 'Author', users: 12, permissions: '12 permissions', description: 'Create and edit own content' },
      { name: 'Moderator', users: 5, permissions: '18 permissions', description: 'Content moderation' },
      { name: 'Viewer', users: 45, permissions: '6 permissions', description: 'Read-only access' },
    ]

    const permissions = [
      { group: 'Content', items: ['Create', 'Edit', 'Delete', 'Publish'] },
      { group: 'Users', items: ['View', 'Create', 'Edit', 'Delete'] },
      { group: 'Settings', items: ['View', 'Edit'] },
      { group: 'Analytics', items: ['View', 'Export'] },
      { group: 'Commerce', items: ['View Orders', 'Manage Products', 'Process Refunds'] },
    ]

    const recentChanges = [
      { user: 'admin@example.com', action: 'Updated role', target: 'Editor', time: '2h ago' },
      { user: 'admin@example.com', action: 'Added permission', target: 'Author - Publish', time: '1d ago' },
      { user: 'admin@example.com', action: 'Created role', target: 'Moderator', time: '3d ago' },
    ]

    return {
      roles,
      permissions,
      recentChanges,
    }
  },
})
