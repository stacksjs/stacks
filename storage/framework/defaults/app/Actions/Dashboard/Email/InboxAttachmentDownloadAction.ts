import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import {
  emailSDK,
  inboxAttachmentContentDisposition,
  inboxAttachmentContentType,
} from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { dashboardMailbox, inboxActionError } from './inbox-request'

export default new Action({
  name: 'InboxAttachmentDownloadAction',
  description: 'Downloads one attachment from a guarded inbound email.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const messageId = String(request.getParam('id') || '')
    const attachmentId = String(request.getParam('attachmentId') || '')

    if (!messageId || !attachmentId)
      return response.json({ message: 'A message ID and attachment ID are required.' }, 422)

    try {
      const mailbox = dashboardMailbox(request)
      const result = await emailSDK.getAttachment(mailbox, messageId, attachmentId)
      if (!result)
        return response.json({ message: 'Attachment not found.' }, 404)

      return new Response(result.body as BodyInit, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': inboxAttachmentContentDisposition(result.attachment.name),
          'Content-Length': String(result.body.byteLength),
          'Content-Type': inboxAttachmentContentType(result.contentType),
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return inboxActionError(error, 'The attachment could not be downloaded.')
    }
  },
})
