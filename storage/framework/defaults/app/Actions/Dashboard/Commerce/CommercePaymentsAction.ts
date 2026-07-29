import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { normalizePaymentRecord, summarizePayments } from './payment-records'

export default new Action({
  name: 'CommercePaymentsAction',
  description: 'Returns persisted commerce payments and currency-safe summaries.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const paymentRows = await payments.fetchAll()
    const records = paymentRows.map(normalizePaymentRecord)
    return {
      records,
      summary: summarizePayments(records),
    }
  },
})
