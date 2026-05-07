import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { buildUnsubscribeHeaders } from '@stacksjs/newsletter'
import { Campaign, CampaignSend, EmailList, EmailListSubscriber, Subscriber } from '@stacksjs/orm'
import { Job } from '@stacksjs/queue'
import { url } from '@stacksjs/router'

/**
 * Newsletter campaign dispatcher.
 *
 * Loads the campaign + its target list, walks every active pivot row,
 * renders the template, attaches per-recipient `List-Unsubscribe`
 * headers (RFC 8058), and hands each envelope to `@stacksjs/email`.
 *
 * Why per-recipient sends instead of one fan-out send?  The pivot
 * UUID is the unsubscribe token — embedding it means we can't share
 * a single envelope across recipients without leaking everyone else's
 * unsubscribe URL via Bcc round-tripping. Per-recipient also lets us
 * record granular CampaignSend status rows for retries and analytics.
 *
 * Failures from a single recipient don't poison the chunk — we record
 * the error on the `CampaignSend` row and keep going. Whole-job
 * failures (e.g. "campaign not found") throw so the queue retries.
 */
interface SendCampaignPayload {
  campaignId: number
  chunkSize?: number
  dryRun?: boolean
}

export default new Job({
  name: 'SendCampaign',
  description: 'Fan a campaign out to its target list (background)',
  queue: 'campaigns',
  // Whole-campaign failures are rare; we don't want a flaky DB to
  // double-send a marketing blast. One automatic retry, then surface.
  tries: 2,
  backoff: [60],

  async handle(payload: SendCampaignPayload) {
    if (!payload?.campaignId)
      throw new Error('[SendCampaign] payload.campaignId is required')

    const campaign = await (Campaign as any).find(payload.campaignId)
    if (!campaign)
      throw new Error(`[SendCampaign] Campaign ${payload.campaignId} not found`)

    if (campaign.status === 'sent' || campaign.status === 'cancelled') {
      log.warn(`[SendCampaign] Skipping campaign ${campaign.id} in status '${campaign.status}'`)
      return { sent: 0, skipped: true }
    }

    if (!campaign.email_list_id)
      throw new Error(`[SendCampaign] Campaign ${campaign.id} has no email_list_id`)

    const list = await (EmailList as any).find(campaign.email_list_id)
    if (!list)
      throw new Error(`[SendCampaign] EmailList ${campaign.email_list_id} not found`)

    await campaign.update({ status: 'sending' })

    const appName = config.app.name || 'Stacks'
    const fromAddress = {
      name: campaign.from_name || config.email.from?.name || appName,
      address: campaign.from_address || config.email.from?.address || 'no-reply@stacksjs.com',
    }
    const unsubscribeMailbox = (config as any)?.email?.unsubscribeMailbox

    const chunkSize = payload.chunkSize ?? 50
    const dryRun = payload.dryRun ?? false

    let sent = 0
    let failed = 0
    let offset = 0

    // Walk active pivots in chunks. We never load the full list into
    // memory — large lists (100k+) would OOM the worker, and we want
    // crash safety: if the worker dies mid-send we can resume from the
    // first subscriber without a CampaignSend row for this campaign.
    while (true) {
      const pivots = await (EmailListSubscriber as any)
        .where('email_list_id', campaign.email_list_id)
        .where('status', 'subscribed')
        .limit(chunkSize)
        .offset(offset)
        .get()

      if (!pivots || pivots.length === 0)
        break

      for (const pivot of pivots) {
        // Skip if we've already sent for this (campaign, subscriber).
        // The unique index protects us, but checking up front avoids a
        // try/catch round-trip per existing row when we resume.
        const existing = await (CampaignSend as any)
          .where('campaign_id', campaign.id)
          .where('subscriber_id', pivot.subscriber_id)
          .first()
        if (existing && existing.status === 'sent')
          continue

        const subscriber = await (Subscriber as any).find(pivot.subscriber_id)
        if (!subscriber || !subscriber.email)
          continue

        // The pivot UUID is the per-list unsubscribe token. Both the
        // header and the in-body link point to the same handler so
        // RFC 8058 one-click and "click the link" land in the same
        // place.
        const unsubscribeUrl = url('email.unsubscribe', { token: pivot.uuid })
        const headers = buildUnsubscribeHeaders({
          url: unsubscribeUrl,
          mailto: unsubscribeMailbox,
        })

        let html: string
        let text: string | undefined
        try {
          const rendered = await template(campaign.template, {
            variables: {
              email: subscriber.email,
              unsubscribeUrl,
              listName: list.name,
              campaignName: campaign.name,
            },
            subject: campaign.subject,
          })
          html = rendered.html
          text = rendered.text
        }
        catch {
          // Template name didn't resolve to a file — fall back to
          // treating campaign.template as raw HTML. Saves you from
          // having to scaffold a .stx file for one-off blasts.
          html = campaign.template
          text = campaign.text || undefined
        }

        const sendRow = existing
          ?? (await (CampaignSend as any).create({
            campaign_id: campaign.id,
            subscriber_id: pivot.subscriber_id,
            email_list_id: campaign.email_list_id,
            status: 'queued',
          }))

        if (dryRun) {
          await sendRow.update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: 'dry-run' })
          sent++
          continue
        }

        try {
          const result = await mail.send({
            to: [subscriber.email],
            from: fromAddress,
            subject: campaign.subject,
            html,
            text,
            // `headers` is optional on EmailMessage — drivers that
            // already propagate raw headers pick this up; ones that
            // don't yet will silently drop and we lose only the
            // RFC 8058 one-click affordance. The in-body link still
            // works in every case.
            headers,
          } as any)

          if (result?.success === false) {
            await sendRow.update({ status: 'failed', error: result?.message ?? 'driver returned failure' })
            failed++
            continue
          }

          await sendRow.update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: result?.messageId ?? null,
          })
          sent++
        }
        catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          await sendRow.update({ status: 'failed', error: message })
          failed++
        }
      }

      offset += pivots.length
    }

    await campaign.update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sent,
    })

    log.debug(`[SendCampaign] campaign=${campaign.id} sent=${sent} failed=${failed}`)
    return { sent, failed }
  },
})
