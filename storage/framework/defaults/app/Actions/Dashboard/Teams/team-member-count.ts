import { db, sql } from '@stacksjs/database'
import { sqlTimestamp } from './team-records'

export async function syncTeamMemberCount(teamId: number, connection: typeof db = db): Promise<number> {
  const row = await (connection as any)
    .selectFrom('team_members')
    .where('team_id', '=', teamId)
    .where('status', '=', 'active')
    .select(sql`count(*) as count`)
    .executeTakeFirst()
  const count = Number(row?.count || 0)
  if (!Number.isSafeInteger(count) || count < 0)
    throw new TypeError('Team member count must be a non-negative integer.')

  await connection
    .updateTable('teams')
    .set({ member_count: count, updated_at: sqlTimestamp() })
    .where('id', '=', teamId)
    .execute()

  return count
}
