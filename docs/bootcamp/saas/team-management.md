# Team Management

The Team Management module provides comprehensive multi-tenant team functionality for SaaS applications. This guide covers creating teams, managing members, sending invitations, and configuring roles and permissions.

## Getting Started

Import the team functionality from the ORM package:

```ts
import { Team, User } from '@stacksjs/orm'
```

## Creating Teams

### Create a New Team

```ts
const team = await Team.create({
  name: 'Acme Corporation',
  company_name: 'Acme Corp',
  email: 'team@acme.com',
  billing_email: 'billing@acme.com',
  status: 'active',
  description: 'Main development team',
  path: 'acme-corp',
  is_personal: false,
})
```

### Create a Personal Team

Personal teams are automatically created for individual users:

```ts
const personalTeam = await Team.create({
  name: `${user.name}'s Team`,
  email: user.email,
  is_personal: true,
  status: 'active',
})
```

## Team Members

### Adding Members to a Team

```ts
// Add a user to a team with a specific role
await TeamMember.create({
  team_id: team.id,
  user_id: user.id,
  role: 'member',
  joined_at: new Date().toISOString(),
})
```

### Fetching Team Members

```ts
// Get all members of a team
const members = await TeamMember
  .where('team_id', '=', team.id)
  .get()

// Get members with user details
const membersWithDetails = await TeamMember
  .with(['user'])
  .where('team_id', '=', team.id)
  .get()
```

### Removing Team Members

```ts
await TeamMember
  .where('team_id', '=', team.id)
  .where('user_id', '=', userId)
  .delete()
```

## Team Invitations

### Sending Invitations

```ts
import { TeamInvitation } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'

// Create an invitation
const invitation = await TeamInvitation.create({
  team_id: team.id,
  email: 'newmember@example.com',
  role: 'member',
  token: randomUUIDv7(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
})

// Send invitation email
await sendInvitationEmail(invitation)
```

### Accepting Invitations

```ts
async function acceptInvitation(token: string, user: UserModel) {
  const invitation = await TeamInvitation
    .where('token', '=', token)
    .where('expires_at', '>', new Date().toISOString())
    .first()

  if (!invitation) {
    throw new Error('Invalid or expired invitation')
  }

  // Add user to team
  await TeamMember.create({
    team_id: invitation.team_id,
    user_id: user.id,
    role: invitation.role,
    joined_at: new Date().toISOString(),
  })

  // Delete the invitation
  await invitation.delete()

  return invitation
}
```

### Revoking Invitations

```ts
await TeamInvitation
  .where('id', '=', invitationId)
  .delete()
```

## Roles and Permissions

### Available Roles

Define your roles in the configuration:

```ts
// config/team.ts
export default {
  roles: {
    owner: {
      name: 'Owner',
      permissions: ['*'], // All permissions
    },
    admin: {
      name: 'Administrator',
      permissions: [
        'team:manage',
        'members:invite',
        'members:remove',
        'billing:view',
        'billing:manage',
      ],
    },
    member: {
      name: 'Member',
      permissions: [
        'team:view',
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

### Checking Permissions

```ts
async function hasPermission(
  user: UserModel,
  team: TeamModel,
  permission: string
): Promise<boolean> {
  const member = await TeamMember
    .where('team_id', '=', team.id)
    .where('user_id', '=', user.id)
    .first()

  if (!member) return false

  const roleConfig = config.team.roles[member.role]

  if (!roleConfig) return false

  // Check for wildcard permission
  if (roleConfig.permissions.includes('*')) return true

  return roleConfig.permissions.includes(permission)
}
```

### Middleware for Permission Checks

```ts
// app/Middleware/TeamPermission.ts
import type { MiddlewareNext, Request } from '@stacksjs/types'

export async function teamPermission(
  request: Request,
  next: MiddlewareNext,
  permission: string
) {
  const user = request.user
  const teamId = request.params.teamId

  const team = await Team.find(teamId)

  if (!team) {
    return Response.json({ error: 'Team not found' }, { status: 404 })
  }

  const allowed = await hasPermission(user, team, permission)

  if (!allowed) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return next()
}
```

## Updating Team Roles

```ts
async function updateMemberRole(
  teamId: number,
  userId: number,
  newRole: string
) {
  await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', userId)
    .update({ role: newRole })
}
```

## Team Settings

### Updating Team Information

```ts
const team = await Team.find(teamId)

if (team) {
  await team.update({
    name: 'New Team Name',
    description: 'Updated description',
    billing_email: 'new-billing@example.com',
  })
}
```

### Team Status Management

```ts
// Deactivate a team
await team.update({ status: 'inactive' })

// Reactivate a team
await team.update({ status: 'active' })

// Suspend a team
await team.update({ status: 'suspended' })
```

## API Endpoints

The Team Management module provides RESTful API endpoints:

```
GET    /api/teams                    # List user's teams
POST   /api/teams                    # Create a new team
GET    /api/teams/{id}               # Get team details
PATCH  /api/teams/{id}               # Update team
DELETE /api/teams/{id}               # Delete team

GET    /api/teams/{id}/members       # List team members
POST   /api/teams/{id}/members       # Add team member
DELETE /api/teams/{id}/members/{userId} # Remove team member
PATCH  /api/teams/{id}/members/{userId} # Update member role

POST   /api/teams/{id}/invitations   # Send invitation
GET    /api/teams/{id}/invitations   # List pending invitations
DELETE /api/teams/{id}/invitations/{inviteId} # Revoke invitation
POST   /api/invitations/{token}/accept # Accept invitation
```

### Example API Usage

```ts
// List user's teams
const response = await fetch('/api/teams', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
const teams = await response.json()

// Create a new team
const response = await fetch('/api/teams', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'New Team',
    company_name: 'New Company',
    email: 'team@newcompany.com',
  }),
})
const newTeam = await response.json()

// Invite a member
const response = await fetch(`/api/teams/${teamId}/invitations`, {
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
```

## Switching Teams

For applications where users can belong to multiple teams:

```ts
async function switchTeam(user: UserModel, teamId: number) {
  // Verify user belongs to the team
  const member = await TeamMember
    .where('team_id', '=', teamId)
    .where('user_id', '=', user.id)
    .first()

  if (!member) {
    throw new Error('You are not a member of this team')
  }

  // Update user's current team
  await user.update({ current_team_id: teamId })

  return Team.find(teamId)
}
```

## Error Handling

The Team Management module includes built-in error handling:

- Attempting to add a user who is already a team member throws an error
- Invalid invitation tokens return appropriate error messages
- Permission checks fail gracefully with clear error responses
- Role updates validate against available roles

```ts
try {
  await TeamMember.create({
    team_id: team.id,
    user_id: user.id,
    role: 'member',
  })
} catch (error) {
  if (error.message.includes('duplicate')) {
    console.error('User is already a team member')
  }
  throw error
}
```

This documentation covers the essential team management functionality. Each function is type-safe and designed for seamless integration with your Stacks application.
