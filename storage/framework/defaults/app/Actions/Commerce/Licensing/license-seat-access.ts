import type { RequestInstance } from '@stacksjs/types'
import type { License } from '@stacksjs/commerce'
import { resolveAuthenticatedUser } from '@stacksjs/auth'
import { licensing } from '@stacksjs/commerce'
import { db } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'

/**
 * The team license a seat request is about, once the caller is known to run
 * its team. Seats are managed by an active `owner` or `admin` of the `Team`
 * the license belongs to, and by nobody else, key or no key.
 */
export async function seatLicense(request: RequestInstance): Promise<{ license: License, error?: undefined } | { error: Response, license?: undefined }> {
  const user = await resolveAuthenticatedUser(request as any)
  if (!user?.id)
    return { error: response.json({ ok: false, reason: 'unauthenticated', message: 'Sign in to manage seats.' }, 401) }

  const license = await licensing.findLicenseByKey(request.get('key'))
  const member = license?.teamId
    ? await db.selectFrom('team_members')
        .where('team_id', '=', license.teamId)
        .where('user_id', '=', Number(user.id))
        .where('status', '=', 'active')
        .select(['id', 'role'])
        .executeTakeFirst()
    : null
  // One answer for "no such license" and "not your team's".
  if (!license || license.tier !== 'team' || !member || !['owner', 'admin'].includes(String(member.role)))
    return { error: response.json({ ok: false, reason: 'not-found', message: 'That team license was not found.' }, 404) }
  return { license }
}
