# Manage Team

This guide covers team collaboration features in Stacks, including user management, access control, role-based permissions, and team communication.

## Getting Started

Import the team management functionality:

```ts
import { Team, TeamMember, User } from '@stacksjs/orm'
```

## User Management

### Inviting Team Members

```ts
import { TeamInvitation } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'

async function inviteTeamMember(
  teamId: number,
  email: string,
  role: string,
  invitedBy: number
) {
  // Check if already a member
  const existingMember = await TeamMember
    .where('team_id', '=', teamId)
    .where('email', '=', email)
    .first()

  if (existingMember) {
    throw new Error('User is already a team member')
  }

  // Check for pending invitation
  const existingInvite = await TeamInvitation
    .where('team_id', '=', teamId)
    .where('email', '=', email)
    .where('status', '=', 'pending')
    .first()

  if (existingInvite) {
    throw new Error('Invitation already sent to this email')
  }

  // Create invitation
  const invitation = await TeamInvitation.create({
    team_id: teamId,
    email,
    role,
    invited_by: invitedBy,
    token: randomUUIDv7(),
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // Send invitation email
  await sendInvitationEmail({
    to: email,
    inviteUrl: `${process.env.APP_URL}/invitations/${invitation.token}`,
    teamName: (await Team.find(teamId))?.name,
    inviterName: (await User.find(invitedBy))?.name,
  })

  return invitation
}
```

### Accepting Invitations

```ts
async function acceptInvitation(token: string, userId: number) {
  const invitation = await TeamInvitation
    .where('token', '=', token)
    .where('status', '=', 'pending')
    .first()

  if (!invitation) {
    throw new Error('Invalid or expired invitation')
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    await invitation.update({ status: 'expired' })
    throw new Error('Invitation has expired')
  }

  // Get user
  const user = await User.find(userId)

  if (!user) {
    throw new Error('User not found')
  }

  // Add to team
  await TeamMember.create({
    team_id: invitation.team_id,
    user_id: userId,
    role: invitation.role,
    joined_at: new Date().toISOString(),
  })

  // Update invitation status
  await invitation.update({ status: 'accepted' })

  return {
    team: await Team.find(invitation.team_id),
    role: invitation.role,
  }
}
```

### Removing Team Members

```ts
async function removeTeamMember(
  teamId: number,
  userId: number,
  removedBy: number
) {
  // Check if remover has permission
  const remover = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', removedBy)
    .first()

  if (!remover || !['owner', 'admin'].includes(remover.role)) {
    throw new Error('You do not have permission to remove team members')
  }

  // Cannot remove owner
  const memberToRemove = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', userId)
    .first()

  if (memberToRemove?.role === 'owner') {
    throw new Error('Cannot remove the team owner')
  }

  // Remove member
  await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', userId)
    .delete()

  // Notify the removed user
  await sendNotification({
    userId,
    type: 'team_removed',
    message: `You have been removed from the team`,
  })

  return { success: true }
}
```

## Access Control

### Role-Based Permissions

```ts
// config/team.ts
export default {
  roles: {
    owner: {
      name: 'Owner',
      permissions: ['*'],
      canBeRemoved: false,
      canBeChanged: false,
    },
    admin: {
      name: 'Administrator',
      permissions: [
        'team:manage',
        'members:invite',
        'members:remove',
        'members:update',
        'projects:manage',
        'billing:view',
        'billing:manage',
        'settings:manage',
      ],
    },
    manager: {
      name: 'Manager',
      permissions: [
        'team:view',
        'members:invite',
        'projects:manage',
        'billing:view',
      ],
    },
    member: {
      name: 'Member',
      permissions: [
        'team:view',
        'projects:view',
        'projects:create',
        'projects:edit',
      ],
    },
    viewer: {
      name: 'Viewer',
      permissions: [
        'team:view',
        'projects:view',
      ],
    },
  },
}
```

### Permission Checking

```ts
import { config } from '@stacksjs/config'

async function hasPermission(
  userId: number,
  teamId: number,
  permission: string
): Promise<boolean> {
  const member = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', userId)
    .first()

  if (!member) return false

  const roleConfig = config.team.roles[member.role]
  if (!roleConfig) return false

  // Wildcard permission (owner)
  if (roleConfig.permissions.includes('*')) return true

  // Check specific permission
  if (roleConfig.permissions.includes(permission)) return true

  // Check permission prefix (e.g., 'projects:*' matches 'projects:create')
  const [resource] = permission.split(':')
  if (roleConfig.permissions.includes(`${resource}:*`)) return true

  return false
}

// Usage in actions
async function updateProject(userId: number, teamId: number, projectId: number, data: any) {
  const canEdit = await hasPermission(userId, teamId, 'projects:edit')

  if (!canEdit) {
    throw new Error('You do not have permission to edit projects')
  }

  return Project.where('id', '=', projectId).update(data)
}
```

### Permission Middleware

```ts
// middleware/TeamPermission.ts
export function requirePermission(permission: string) {
  return async (request: Request, next: Function) => {
    const user = request.user
    const teamId = request.params.teamId || request.body.team_id

    if (!teamId) {
      return Response.json({ error: 'Team ID required' }, { status: 400 })
    }

    const allowed = await hasPermission(user.id, parseInt(teamId), permission)

    if (!allowed) {
      return Response.json({ error: 'Permission denied' }, { status: 403 })
    }

    return next()
  }
}

// Usage in routes
router.put(
  '/teams/:teamId/settings',
  requirePermission('settings:manage'),
  updateTeamSettings
)
```

## Team Settings

### Updating Team Information

```ts
async function updateTeamSettings(
  teamId: number,
  userId: number,
  settings: {
    name?: string
    description?: string
    logo?: string
    timezone?: string
    settings?: Record<string, any>
  }
) {
  // Check permission
  const canManage = await hasPermission(userId, teamId, 'settings:manage')

  if (!canManage) {
    throw new Error('You do not have permission to manage team settings')
  }

  const team = await Team.find(teamId)

  if (!team) {
    throw new Error('Team not found')
  }

  await team.update({
    name: settings.name || team.name,
    description: settings.description || team.description,
    logo: settings.logo || team.logo,
    timezone: settings.timezone || team.timezone,
    settings: JSON.stringify({
      ...JSON.parse(team.settings || '{}'),
      ...settings.settings,
    }),
  })

  return team
}
```

### Team Preferences

```ts
async function getTeamPreferences(teamId: number) {
  const team = await Team.find(teamId)

  if (!team) throw new Error('Team not found')

  return JSON.parse(team.settings || '{}')
}

async function updateTeamPreference(
  teamId: number,
  key: string,
  value: any
) {
  const team = await Team.find(teamId)

  if (!team) throw new Error('Team not found')

  const settings = JSON.parse(team.settings || '{}')
  settings[key] = value

  await team.update({ settings: JSON.stringify(settings) })

  return settings
}
```

## Role Management

### Updating Member Roles

```ts
async function updateMemberRole(
  teamId: number,
  memberId: number,
  newRole: string,
  updatedBy: number
) {
  // Check permission
  const canUpdate = await hasPermission(updatedBy, teamId, 'members:update')

  if (!canUpdate) {
    throw new Error('You do not have permission to update member roles')
  }

  // Get member to update
  const member = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', memberId)
    .first()

  if (!member) {
    throw new Error('Team member not found')
  }

  // Cannot change owner role
  if (member.role === 'owner') {
    throw new Error('Cannot change the owner role')
  }

  // Validate new role exists
  if (!config.team.roles[newRole]) {
    throw new Error('Invalid role')
  }

  // Cannot promote to owner
  if (newRole === 'owner') {
    throw new Error('Cannot promote to owner')
  }

  await member.update({ role: newRole })

  // Notify member of role change
  await sendNotification({
    userId: memberId,
    type: 'role_changed',
    message: `Your role has been changed to ${config.team.roles[newRole].name}`,
  })

  return member
}
```

### Transferring Ownership

```ts
async function transferOwnership(
  teamId: number,
  newOwnerId: number,
  currentOwnerId: number
) {
  // Verify current owner
  const currentOwner = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', currentOwnerId)
    .where('role', '=', 'owner')
    .first()

  if (!currentOwner) {
    throw new Error('You are not the team owner')
  }

  // Verify new owner is a team member
  const newOwner = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', newOwnerId)
    .first()

  if (!newOwner) {
    throw new Error('New owner must be a team member')
  }

  // Transfer ownership
  await currentOwner.update({ role: 'admin' })
  await newOwner.update({ role: 'owner' })

  // Notify both users
  await sendNotification({
    userId: newOwnerId,
    type: 'ownership_received',
    message: 'You are now the team owner',
  })

  await sendNotification({
    userId: currentOwnerId,
    type: 'ownership_transferred',
    message: 'You have transferred team ownership',
  })

  return { success: true }
}
```

## Activity Logging

### Logging Team Activities

```ts
async function logTeamActivity(
  teamId: number,
  userId: number,
  action: string,
  details?: Record<string, any>
) {
  await TeamActivity.create({
    team_id: teamId,
    user_id: userId,
    action,
    details: JSON.stringify(details || {}),
    ip_address: request.ip,
    user_agent: request.headers.get('user-agent'),
    created_at: new Date().toISOString(),
  })
}

// Usage
await logTeamActivity(teamId, userId, 'member.invited', {
  invitedEmail: email,
  role: role,
})

await logTeamActivity(teamId, userId, 'settings.updated', {
  changes: ['name', 'description'],
})
```

### Viewing Activity Log

```ts
async function getTeamActivityLog(
  teamId: number,
  options: {
    limit?: number
    offset?: number
    userId?: number
    action?: string
  } = {}
) {
  let query = TeamActivity
    .with(['user'])
    .where('team_id', '=', teamId)
    .orderBy('created_at', 'desc')

  if (options.userId) {
    query = query.where('user_id', '=', options.userId)
  }

  if (options.action) {
    query = query.where('action', 'like', `${options.action}%`)
  }

  const activities = await query
    .limit(options.limit || 50)
    .offset(options.offset || 0)
    .get()

  return activities.map(activity => ({
    id: activity.id,
    user: activity.user?.name,
    action: activity.action,
    details: JSON.parse(activity.details || '{}'),
    createdAt: activity.created_at,
  }))
}
```

## API Endpoints

```
GET    /api/teams/:teamId/members        # List team members
POST   /api/teams/:teamId/members        # Invite member
DELETE /api/teams/:teamId/members/:userId # Remove member
PATCH  /api/teams/:teamId/members/:userId # Update member role

GET    /api/teams/:teamId/invitations    # List pending invitations
POST   /api/teams/:teamId/invitations    # Send invitation
DELETE /api/teams/:teamId/invitations/:id # Cancel invitation
POST   /api/invitations/:token/accept    # Accept invitation

GET    /api/teams/:teamId/settings       # Get team settings
PATCH  /api/teams/:teamId/settings       # Update team settings

GET    /api/teams/:teamId/activity       # Get activity log
```

### Example API Usage

```ts
// Invite team member
const response = await fetch(`/api/teams/${teamId}/members`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    email: 'newmember@example.com',
    role: 'member',
  }),
})

// Update member role
const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    role: 'admin',
  }),
})

// Get activity log
const response = await fetch(`/api/teams/${teamId}/activity?limit=20`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
```

## Error Handling

```ts
try {
  await inviteTeamMember(teamId, email, role, userId)
} catch (error) {
  if (error.message.includes('already a team member')) {
    showError('This user is already on your team')
  } else if (error.message.includes('Invitation already sent')) {
    showError('An invitation has already been sent to this email')
  } else if (error.message.includes('permission')) {
    showError('You do not have permission to invite members')
  } else {
    showError('Failed to send invitation')
  }
}
```

This documentation covers team collaboration and access control functionality. Each function is designed for secure and flexible team management.
