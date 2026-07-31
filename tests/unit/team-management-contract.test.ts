import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('team management contract', () => {
  test('models memberships and invitations with authenticated generated APIs', () => {
    const member = source('storage/framework/defaults/app/Models/TeamMember.ts')
    const invitation = source('storage/framework/defaults/app/Models/TeamInvitation.ts')

    expect(member).toContain("table: 'team_members'")
    expect(member).toContain("uri: 'team-members'")
    expect(member).toContain("routes: ['index', 'store', 'show', 'update', 'destroy']")
    expect(member).toContain("middleware: ['auth']")
    expect(member).toContain("columns: ['team_id', 'user_id']")
    expect(member).toContain('unique: true')

    expect(invitation).toContain("table: 'team_invitations'")
    expect(invitation).toContain("uri: 'team-invitations'")
    expect(invitation).toContain("routes: ['index', 'show', 'destroy']")
    expect(invitation).toContain("middleware: ['auth']")
    expect(invitation).toContain('tokenHash:')
    expect(invitation).toContain('hidden: true')
  })

  test('ships model-generated migrations for both team tables', () => {
    const memberMigration = source('database/migrations/0000000163-create-team_members-table.sql')
    const invitationMigration = source('database/migrations/0000000162-create-team_invitations-table.sql')
    const countBackfill = source('database/migrations/0000000166-sync-team-member-counts.sql')

    expect(memberMigration).toContain('CREATE TABLE IF NOT EXISTS "team_members"')
    expect(memberMigration).toContain('REFERENCES "teams"("id")')
    expect(memberMigration).toContain('REFERENCES "users"("id")')
    expect(memberMigration).toContain('UNIQUE INDEX')

    expect(invitationMigration).toContain('CREATE TABLE IF NOT EXISTS "team_invitations"')
    expect(invitationMigration).toContain('"token_hash" TEXT not null')
    expect(invitationMigration).toContain('"delivery_status"')
    expect(invitationMigration).toContain('UNIQUE INDEX')
    expect(countBackfill).toContain('COUNT(*)')
    expect(countBackfill).toContain('"team_members"."status" = \'active\'')
  })

  test('connects dashboard management and secure invitation acceptance routes', () => {
    const dashboardRoutes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const appRoutes = source('storage/framework/defaults/routes/dashboard.ts')
    const acceptance = source('storage/framework/defaults/app/Actions/Teams/AcceptInvitationAction.ts')
    const revocation = source('storage/framework/defaults/app/Actions/Dashboard/Teams/TeamInvitationDestroyAction.ts')

    expect(dashboardRoutes).toContain("route.get('/teams/{id}/people', 'Actions/Dashboard/Teams/TeamPeopleIndexAction')")
    expect(dashboardRoutes).toContain("route.post('/teams/{id}/invitations', 'Actions/Dashboard/Teams/TeamInviteAction')")
    expect(dashboardRoutes).toContain("route.post('/teams/{id}/invitations/{invitationId}/resend'")
    expect(dashboardRoutes).toContain("route.patch('/teams/{id}/members/{memberId}'")
    expect(dashboardRoutes).toContain("route.delete('/teams/{id}/members/{memberId}'")

    expect(appRoutes).toContain("route.get('/api/team-invitation-links/{token}', 'Actions/Teams/ShowInvitationAction')")
    expect(appRoutes).toContain("route.post('/api/team-invitations/{token}/accept', 'Actions/Teams/AcceptInvitationAction').middleware('auth')")
    expect(acceptance).toContain('db.transaction')
    expect(acceptance).toContain("where('status', '=', 'pending')")
    expect(acceptance).toContain('token_hash: hashInvitationToken(generateInvitationToken())')
    expect(revocation).toContain('token_hash: hashInvitationToken(generateInvitationToken())')
  })

  test('renders team management through a reusable STX component and canonical buttons', () => {
    const view = source('storage/framework/defaults/views/dashboard/teams/[id].stx')
    const invitationView = source('storage/framework/defaults/views/dashboard/team-invitations/[token].stx')
    const acceptance = source('storage/framework/defaults/resources/components/Dashboard/Teams/TeamInvitationDashboard.stx')
    const apiClient = source('storage/framework/defaults/functions/dashboard-api.ts')
    const component = source('storage/framework/defaults/resources/components/Dashboard/Teams/TeamPeopleDashboard.stx')

    expect(view).toContain('<TeamPeopleDashboard />')
    expect(invitationView).toContain('<TeamInvitationDashboard />')
    expect(invitationView).not.toContain('<script')
    expect(component).toContain('<Button')
    expect(component).toContain('variant="primary"')
    expect(component).toContain('Send invitation')
    expect(component).toContain('<ConfirmDialog')
    expect(component).not.toMatch(/<button\b/)
    expect(component).not.toContain('document.')
    expect(component).not.toContain('window.')
    expect(acceptance).toContain('Accept invitation')
    expect(acceptance).toContain('variant="primary"')
    expect(acceptance).toContain('auth: false')
    expect(apiClient).toContain('options.auth !== false')
  })
})
