import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { AnalyticsEvent, ModelValidationError } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

function token(value: unknown, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

export default new Action({
  name: 'EventStoreAction',
  description: 'Records an analytics event from the guarded dashboard surface.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const name = token(request.get('name'), '')
    const category = token(request.get('category'), 'custom')
    const path = String(request.get('path') || '').trim()
    const value = Number(request.get('value') || 0)
    const currency = String(request.get('currency') || 'USD').trim().toUpperCase()
    const rawProperties = request.get('properties')
    const properties = rawProperties === undefined || rawProperties === null || rawProperties === ''
      ? ''
      : typeof rawProperties === 'string'
        ? rawProperties
        : JSON.stringify(rawProperties)

    if (!name)
      return response.json({ message: 'Event name is required.' }, 422)
    if (name.length > 100)
      return response.json({ message: 'Event name must be 100 characters or fewer.' }, 422)
    if (category.length > 50)
      return response.json({ message: 'Category must be 50 characters or fewer.' }, 422)
    if (path.length > 2048)
      return response.json({ message: 'Path must be 2048 characters or fewer.' }, 422)
    if (!Number.isFinite(value) || value < 0)
      return response.json({ message: 'Value must be a non-negative number.' }, 422)
    if (!/^[A-Z]{3}$/.test(currency))
      return response.json({ message: 'Currency must be a three-letter code.' }, 422)
    if (properties.length > 10_000)
      return response.json({ message: 'Properties must be 10,000 characters or fewer.' }, 422)

    try {
      await AnalyticsEvent.create({
        name,
        category,
        path,
        value,
        currency,
        properties,
      })
    }
    catch (error) {
      if (error instanceof ModelValidationError) {
        return response.json({
          message: 'Validation failed.',
          errors: error.errors,
        }, 422)
      }
      return dashboardOperationalError(error, 'Analytics event could not be recorded.', 'EventStoreAction', 500)
    }

    return response.json({ success: true }, 201)
  },
})
