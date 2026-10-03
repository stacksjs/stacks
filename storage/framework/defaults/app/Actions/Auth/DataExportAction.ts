import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'
import { exportSubjectData } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

/**
 * Self-service data export: the signed-in user downloads their own personal
 * data (GDPR Articles 15 and 20, stacksjs/stacks#365).
 *
 * The subject is always the authenticated caller - there is no id parameter
 * to tamper with. The export carries only what the models declare personal,
 * plus ids, timestamps and the purpose/basis/retention each model states.
 * Each one is recorded in `gdpr_requests` with the caller as actor, and the
 * route is rate-limited because an export reads every table the user touches.
 */
export default new Action({
  name: 'DataExportAction',
  description: 'Download the authenticated user\'s personal data',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user?.id)
      return response.unauthorized('Authentication required')

    const result = await exportSubjectData(user.id, { actor: `api:user:${String(user.id)}` })
    log.info(`[gdpr] access export served to user ${String(user.id)}`)

    const day = result.generatedAt.slice(0, 10)
    return new Response(`${JSON.stringify(result, null, 2)}\n`, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="personal-data-${day}.json"`,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
})
