import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { EmailList } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingListWriteData, validateMarketingListWriteData } from './marketing-list-records'
import { marketingModelError } from './marketing-response'

export default new Action({
  name: 'MarketingListStoreAction',
  description: 'Creates a persisted EmailList record from the dashboard.',
  method: 'POST',
  model: EmailList,

  async handle(request: RequestInstance) {
    const data = marketingListWriteData(await request.all())
    const validationError = validateMarketingListWriteData(data)
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      const duplicate = await EmailList.where('slug', data.slug).first()
      if (duplicate)
        return response.json({ message: 'An email list with this slug already exists.' }, 422)

      const list = await EmailList.create({
        name: data.name,
        slug: data.slug,
        description: data.description,
        status: data.status,
        is_public: data.isPublic,
        double_opt_in: data.doubleOptIn,
        subscriber_count: 0,
        active_count: 0,
        unsubscribed_count: 0,
        bounced_count: 0,
      })

      return response.json({ id: list.get('id') }, 201)
    }
    catch (error) {
      return marketingModelError(
        error,
        'Email list could not be created.',
        'ListStoreAction',
        'An email list with this slug already exists.',
      )
    }
  },
})
