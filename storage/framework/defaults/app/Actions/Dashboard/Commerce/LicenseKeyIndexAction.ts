import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseLicenseKeyListQuery, readLicenseKeyPage } from './commerce-license-key-list'

/**
 * `GET /api/dashboard/commerce/license-keys` - one page of licence keys,
 * searched, sorted and counted by the database, with the summary of every key
 * and each key's customer, product and order (commerce-license-key-list.ts,
 * stacksjs/stacks#3218). It used to return the newest 500 as a bare array.
 */
export default new Action({
  name: 'Dashboard License Keys',
  description: 'Returns one page of license keys with lightweight customer, product, and order summaries.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseLicenseKeyListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const keys = await readLicenseKeyPage(query)
      return {
        records: keys.records,
        total: keys.total,
        page: keys.page,
        perPage: query.perPage,
        summary: keys.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'License key records could not be read.', 'LicenseKeyIndexAction')
    }
  },
})
