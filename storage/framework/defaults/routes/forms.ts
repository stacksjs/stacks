import { requestHost, resolveSiteByHost, sitesOptions } from '@stacksjs/sites'
import { response, route } from '@stacksjs/router'

/**
 * Public form endpoints (`@stacksjs/forms`). The admin builder surface is
 * the models' own auth'd `useApi` routes plus the export route below; these
 * two are what a visitor's browser talks to.
 *
 * CSRF: the submit endpoint keeps the default-on double-submit protection.
 * A form rendered by the CMS `form` block lives on the same origin, so the
 * page-seeded cookie + header work exactly like every other public form.
 * (Cross-origin embeds would need a `.skipCsrf()` variant with an Origin
 * allowlist - deliberately not shipped until something needs it.)
 */

async function siteIdForRequest(request: any): Promise<number | null> {
  const options = sitesOptions()
  if (!options.enabled)
    return null

  const headers: Headers = request.headers instanceof Headers
    ? request.headers
    : new Headers(request.headers ?? {})
  const site = await resolveSiteByHost(requestHost(headers, options), undefined, options)
  return site?.id ?? null
}

route.get('/api/forms/{uuid}', async (request: any) => {
  const { loadFormByUuid, publicDefinition } = await import('@stacksjs/forms')

  const form = await loadFormByUuid(String(request.params?.uuid ?? request.param?.('uuid') ?? ''), await siteIdForRequest(request))
  if (!form || form.status === 'draft')
    return response.notFound('Form not found')

  return response.json(publicDefinition(form))
}).rateLimit(60, 'minute')

/**
 * File uploads for a form's `file` fields.
 *
 * Proxied through the server rather than presigned, because this is where the
 * ceilings in `config/forms.ts` can actually be applied: a presigned policy can
 * express a size cap but not a real type check (S3 sees only the Content-Type
 * the client declared), and a proxied upload works on a local disk too. A
 * public form is not a bulk-upload surface. stacksjs/stacks#2406.
 *
 * The stored path is returned for the submit step, which checks it sits under
 * this form's prefix before accepting it.
 */
route.post('/api/forms/{uuid}/uploads', async (request: any) => {
  const { checkUpload, fileFieldNamed, formUploadPrefix, loadFormByUuid, resolveUploadLimits } = await import('@stacksjs/forms')

  const form = await loadFormByUuid(String(request.params?.uuid ?? request.param?.('uuid') ?? ''), await siteIdForRequest(request))
  if (!form || form.status === 'draft')
    return response.notFound('Form not found')

  // Same gate the submit endpoint applies: a closed form does not take files
  // either, and accepting them would leave orphans nothing ever references.
  if (form.status !== 'active')
    return response.json({ message: 'This form is not accepting responses.' }, { status: 409 })

  const field = fileFieldNamed(form, request.get?.('field') ?? request.input?.('field'))
  if (!field)
    return response.json({ message: 'Unknown upload field.' }, { status: 422 })

  const file = request.file?.('file')
  if (!file)
    return response.json({ message: `${field.label} is required.` }, { status: 422 })

  const limits = resolveUploadLimits(field)
  const rejection = checkUpload(field, { name: file.name, size: file.size }, limits)
  if (rejection)
    return response.json({ message: rejection.message }, { status: rejection.status })

  const { Storage } = await import('@stacksjs/storage')
  const stored = await Storage.put(file, {
    ...(limits.disk ? { disk: limits.disk } : {}),
    dir: formUploadPrefix(form),
  })

  return response.json({ path: stored.path }, { status: 201 })
}).rateLimit(20, 'minute')

route.post('/api/forms/{uuid}/submissions', async (request: any) => {
  const { dispatchSubmissionNotifications, loadFormByUuid, submitForm } = await import('@stacksjs/forms')

  const form = await loadFormByUuid(String(request.params?.uuid ?? request.param?.('uuid') ?? ''), await siteIdForRequest(request))
  if (!form)
    return response.notFound('Form not found')

  const body = (typeof request.all === 'function' ? request.all() : request.body) ?? {}
  const { _hp, _renderedMs, ...payload } = body as Record<string, unknown>

  const result = await submitForm(form, payload, {
    ip: typeof request.ip === 'function' ? request.ip() : request.ip,
    honeypot: typeof _hp === 'string' ? _hp : undefined,
    renderedAtMs: typeof _renderedMs === 'number' ? _renderedMs : undefined,
  })

  if (!result.ok) {
    if (result.status === 422)
      return response.json({ errors: result.errors }, { status: 422 })
    return response.json({ message: result.message }, { status: result.status })
  }

  // Fire-and-forget AFTER the write: a slow mail transport must not hold a
  // parent's phone on a spinner, and a failed one must not undo the answers.
  if (result.submissionId > 0) {
    void dispatchSubmissionNotifications(form, result, {
      ...await submissionIdentity(result.submissionId),
    }).catch(() => {})
  }

  return response.json({
    message: result.confirmation ?? 'Thanks - your response was received.',
    status: result.status,
    submission: result.submissionUuid,
    amount_cents: result.amountCents,
    redirect: result.redirect,
  }, { status: 201 })
}).rateLimit(10, 'minute')

async function submissionIdentity(submissionId: number): Promise<{ email: string | null, name: string | null, values: Record<string, unknown> }> {
  const { db } = await import('@stacksjs/database')
  const row = await db
    .selectFrom('form_submissions')
    .where('id', '=', submissionId)
    .select(['email', 'name', 'values'])
    .executeTakeFirst() as { email: string | null, name: string | null, values: string | null } | undefined

  let values: Record<string, unknown> = {}
  try {
    values = row?.values ? JSON.parse(row.values) as Record<string, unknown> : {}
  }
  catch {
    // unreadable values only degrade the notification summary
  }
  return { email: row?.email ?? null, name: row?.name ?? null, values }
}

/** Admin CSV export. Auth'd; site scoping rides the form lookup. */
route.get('/api/admin/forms/{uuid}/submissions.csv', async (request: any) => {
  const { exportSubmissionsCsv, loadFormByUuid } = await import('@stacksjs/forms')

  const form = await loadFormByUuid(String(request.params?.uuid ?? request.param?.('uuid') ?? ''), await siteIdForRequest(request))
  if (!form)
    return response.notFound('Form not found')

  const csv = await exportSubmissionsCsv(form)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${form.handle}-submissions.csv"`,
    },
  })
}).middleware('auth')
