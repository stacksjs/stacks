import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseNamedSearchQuery } from '../named-search'
import type { LicenseKeyChoiceKind } from './commerce-license-key-list'
import { LICENSE_KEY_CHOICE_KINDS, searchLicenseKeyChoices } from './commerce-license-key-list'

/**
 * `GET /api/dashboard/commerce/license-key-options` - the customers, products
 * and orders the licence key dialog offers (stacksjs/stacks#3218). It used to
 * send the first 500 of each.
 *
 * With `kind` (customers, products or orders) and `q`, it searches that one
 * and answers `{ choices, total }`, which is what the dialog asks for as each
 * search box is typed in. Without `kind` it answers the first `limit` of each
 * (25 unless asked) as `{ customers, products, orders, totals }`, the shape
 * useLicenseKeys().fetchLicenseKeyOptions reads, with how many there are.
 */
export default new Action({
  name: 'License Key Options',
  description: 'Searches the customers, products and orders the licence key dialog offers.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseNamedSearchQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)
    const kind = String(request.get<unknown>('kind', '') ?? '').trim()
    if (kind && !(LICENSE_KEY_CHOICE_KINDS as readonly string[]).includes(kind))
      return response.json({ message: `kind must be one of ${LICENSE_KEY_CHOICE_KINDS.join(', ')}.` }, 422)

    try {
      if (kind)
        return { ...await searchLicenseKeyChoices(kind as LicenseKeyChoiceKind, query), limit: query.limit }
      const [customers, products, orders] = await Promise.all(
        LICENSE_KEY_CHOICE_KINDS.map(each => searchLicenseKeyChoices(each, query)),
      )
      return {
        customers: customers!.choices,
        products: products!.choices,
        orders: orders!.choices,
        totals: { customers: customers!.total, products: products!.total, orders: orders!.total },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'License key options could not be read.', 'LicenseKeyOptionsAction')
    }
  },
})
