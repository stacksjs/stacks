/**
 * A job can be named with or without its `Job` suffix, as the runtime allows.
 *
 * `resolveJobFile` tries `<name>.ts` and then `<name>Job.ts`: the mailer
 * dispatches `SendEmail` while the framework ships `SendEmailJob.ts`. The type
 * was `keyof Jobs`, the file names only, so once an app's registry was filled
 * `job('SendEmail')` - the call `mail.queue()` makes, and the one the
 * framework's own tests use - failed `buddy test:types` with TS2345.
 *
 * The registry here is the framework's real one, via `registries.d.ts` (see
 * `tsconfig.type-tests.json`). Nothing executes; it is checked by
 * `bun run typecheck`.
 */

import type { EmailMessage } from '@stacksjs/types'
import { job, Jobs } from '../src/job'

declare const message: EmailMessage

// Both spellings resolve, and both carry SendEmailJob's declared payload.
export const suffixless = (): void => {
  job('SendEmail', { message })
  job('SendEmailJob', { message })
  void Jobs.dispatch('SendEmail', { message })
}

export const suffixlessPayloadIsChecked = (): void => {
  // @ts-expect-error - 'mesage' is not a member of SendEmailJob's payload.
  job('SendEmail', { mesage: message })
}

export const stillRejectsUnknownNames = (): void => {
  // @ts-expect-error - no job resolves under this name, with or without the suffix.
  job('SendEmial')
  // @ts-expect-error - the bare suffix is not a job.
  job('')
}
