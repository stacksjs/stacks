import type { FormDefinition } from './types'
import type { SubmitResult } from './submissions'
import { log } from '@stacksjs/logging'
import { notify } from '@stacksjs/notifications'

/**
 * Post-submission notifications: staff notice to `settings.notifyEmails`,
 * confirmation to the submitter when the form captured an email. Called by
 * the route AFTER the write succeeds; every failure is logged, none block
 * or undo the submission - the person's answers are already safe.
 */
export async function dispatchSubmissionNotifications(
  form: FormDefinition,
  result: Extract<SubmitResult, { ok: true }>,
  submission: { email: string | null, name: string | null, values: Record<string, unknown> },
): Promise<void> {
  const summary = Object.entries(submission.values)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')

  for (const staffEmail of form.settings.notifyEmails ?? []) {
    try {
      await notify(
        { email: staffEmail },
        {
          subject: `New ${form.name} submission`,
          body: `${submission.name ?? 'Someone'}${submission.email ? ` <${submission.email}>` : ''} submitted "${form.name}".\n\n${summary}`,
        },
        ['email'],
        { ignorePreferences: true, category: 'forms' },
      )
    }
    catch (error) {
      log.error(`[forms] staff notification to ${staffEmail} failed: ${(error as Error).message}`)
    }
  }

  if (submission.email && result.status === 'complete') {
    try {
      await notify(
        { email: submission.email },
        {
          subject: `We received your ${form.name}`,
          body: `Thanks${submission.name ? `, ${submission.name}` : ''} - your ${form.name} was received.${result.confirmation ? `\n\n${result.confirmation}` : ''}`,
        },
        ['email'],
        { ignorePreferences: true, category: 'forms' },
      )
    }
    catch (error) {
      log.error(`[forms] confirmation to ${submission.email} failed: ${(error as Error).message}`)
    }
  }
}
