import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import { normalizePaymentRecord } from './payment-records'

export default new Action({
  name: 'PaymentRefundAction',
  description: 'Transactionally records a processor-confirmed payment refund.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const amount = request.integer('amount')
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.notFound({ error: 'Payment not found' })
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return response.badRequest({ error: 'Refund amount must be a positive integer in minor units' })

    try {
      const payment = await payments.recordRefund(id, amount)
      return { record: normalizePaymentRecord(payment) }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('not found'))
        return response.notFound({ error: message })
      if (message.includes('cannot be refunded') || message.includes('exceeds the remaining'))
        return response.badRequest({ error: message })

      log.error('[dashboard:payments] Failed to record refund', { id, error })
      return response.error('Unable to record the refund.', 500)
    }
  },
})
