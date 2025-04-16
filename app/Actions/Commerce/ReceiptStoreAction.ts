import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Store',
  description: 'Receipt Store ORM Action',
  method: 'POST',
  async handle(request: ReceiptRequestType) {
    await request.validate()

    const data = {
      order_id: request.get<number>('order_id'),
      customer_id: request.get<number>('customer_id'),
      amount: request.get<number>('amount'),
      print_device_id: request.get<number>('print_device_id'),
      printer: request.get('printer'),
      document: request.get('document'),
      timestamp: request.get<number>('timestamp'),
      status: request.get('status'),
    }

    const model = await receipts.store(data)

    return response.json(model)
  },
})
