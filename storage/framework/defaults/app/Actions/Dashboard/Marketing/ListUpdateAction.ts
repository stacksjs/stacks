import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { EmailList } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingListWriteData, validateMarketingListWriteData } from './marketing-list-records'
import { marketingModelError, marketingRecordId } from './marketing-response'

export default new Action({
  name: 'MarketingListUpdateAction',
  description: 'Updates a persisted EmailList record from the dashboard.',
  method: 'PATCH',
  model: EmailList,

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid email list id is required.' }, 400)
    const data = marketingListWriteData(await request.all())
    const validationError = validateMarketingListWriteData(data)
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      const list = await EmailList.find(id)
      if (!list)
        return response.json({ message: 'Email list not found.' }, 404)

      const duplicates = await EmailList.where('slug', data.slug).get()
      if (duplicates.some(record => Number(record.get('id')) !== id))
        return response.json({ message: 'An email list with this slug already exists.' }, 422)

      await list.update({
        name: data.name,
        slug: data.slug,
        description: data.description,
        status: data.status,
        is_public: data.isPublic,
        double_opt_in: data.doubleOptIn,
      })
      return response.json({ id })
    }
    catch (error) {
      return marketingModelError(
        error,
        'Email list could not be updated.',
        'ListUpdateAction',
        'An email list with this slug already exists.',
      )
    }
  },
})
