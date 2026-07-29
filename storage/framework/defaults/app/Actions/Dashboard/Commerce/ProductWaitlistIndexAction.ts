import { Action } from '@stacksjs/actions'
import { WaitlistProduct } from '@stacksjs/orm'
import { normalizeProductWaitlistRecord, summarizeProductWaitlist } from './product-waitlist-records'

export default new Action({
  name: 'ProductWaitlistIndexAction',
  description: 'Returns native product waitlist records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const rows = await WaitlistProduct.orderByDesc('id').limit(200).get()
      const records = rows.map(normalizeProductWaitlistRecord)
      return {
        records,
        summary: summarizeProductWaitlist(records),
      }
    }
    catch {
      return {
        records: [],
        summary: summarizeProductWaitlist([]),
      }
    }
  },
})
