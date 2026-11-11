import type { RequestInstance } from '@stacksjs/types'
import type { InviteUserInput } from './user-invitation'
import { Action } from '@stacksjs/actions/runtime'
import { findAuthUserRowByEmail, passwordResets } from '@stacksjs/auth'
import { db } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { modelWriteCapabilities, resolveWritableModel } from '../Models/model-write'
import { inviteUser, USER_INVITATION_DAYS } from './user-invitation'

/**
 * `POST /api/dashboard/users/invitations`.
 *
 * Adds a user from the dashboard: creates the account and mails its holder a
 * link to choose their password. See `./user-invitation` for why a user is
 * invited and not typed in.
 */
export default new Action({
  name: 'Dashboard User Invite',
  description: 'Creates a user account and emails its holder a link to choose their password.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance<InviteUserInput>) {
    const resolved = await resolveWritableModel('user')
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)
    if (!modelWriteCapabilities(resolved.Model).invite)
      return response.json({ message: 'Users cannot be invited from the dashboard: the User model does not allow `store` in `dashboard.writes`.' }, 405)

    const input = request.all()
    const result = await inviteUser({ name: input.name, email: input.email }, {
      Model: resolved.Model,
      findUserByEmail: findAuthUserRowByEmail,
      clearSetupLinks: async (email) => {
        await db.deleteFrom('password_resets').where('email', '=', email).execute()
      },
      sendSetupLink: (email, expiresAt) => passwordResets(email).sendEmail({ purpose: 'setup', expiresAt }),
    })

    if (result.ok)
      return { ok: true, id: result.id, email: result.email, expiresInDays: USER_INVITATION_DAYS }
    if (result.reason === 'invalid')
      return response.json({ message: 'Validation failed.', errors: result.errors }, 422)
    if (result.reason === 'undelivered')
      return dashboardOperationalError(result.cause, 'The invitation email could not be sent, so no account was created. Check the mail settings and try again.', 'UserInviteAction.deliver', 502)
    if (result.reason === 'stranded')
      return dashboardOperationalError(result.cause, 'The account was created, but the invitation email could not be sent. The person can choose a password with "Forgot password" on the sign-in page.', 'UserInviteAction.cleanup', 500)
    return dashboardOperationalError(result.cause, 'The user could not be created.', 'UserInviteAction', 500)
  },
})
