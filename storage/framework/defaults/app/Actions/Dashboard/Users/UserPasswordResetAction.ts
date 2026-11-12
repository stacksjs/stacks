import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { passwordResets } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import { parseRowId, resolveWritableModel } from '../Models/model-write'

/**
 * "Send password reset" on a user: mails the account's holder the same link
 * "Forgot password" would, for the person who cannot sign in and wrote to
 * support instead, or who lost the invitation they were sent.
 *
 * It has no route of its own. The User model lists it under
 * `dashboard.actions`, and the dashboard runs it for the record whose button
 * was pressed, which arrives as the `id` route parameter. It is the first
 * action wired that way, and is what one looks like.
 *
 * Nothing about the account changes until the link is used: the current
 * password keeps working, and no session is ended.
 */
export default new Action({
  name: 'Dashboard User Password Reset',
  description: 'Emails a user a link to choose a new password.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const resolved = await resolveWritableModel('user')
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)
    const id = parseRowId(request.getParam('id'))
    const user = id === null ? null : await resolved.Model.find(id)
    if (!user)
      return response.json({ message: 'This user was not found.' }, 404)

    const email = String(safeGet(user, 'email', '') ?? '')
    let sent: boolean
    try {
      sent = await passwordResets(email).sendEmail()
    }
    catch (error) {
      return dashboardOperationalError(error, 'The email could not be sent. Check the mail settings and try again.', 'UserPasswordResetAction.deliver', 502)
    }
    // The account exists, so nothing sent means one went out moments ago:
    // links are throttled per address (`config.auth.passwordReset.throttle`).
    if (!sent)
      return response.json({ message: `A link was sent to ${email} moments ago. Wait a little before sending another.` }, 429)
    return { message: `${email} was sent a link to choose a new password.` }
  },
})
