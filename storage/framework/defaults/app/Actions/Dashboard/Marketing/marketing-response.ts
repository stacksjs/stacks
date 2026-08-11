import type { RequestInstance } from '@stacksjs/types'
import { isUniqueViolation, ModelValidationError } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

export function marketingRecordId(request: RequestInstance): number | null {
  const id = Number(request.getParam('id'))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function marketingModelError(
  error: unknown,
  message: string,
  action: string,
  duplicateMessage?: string,
): Response {
  if (error instanceof ModelValidationError) {
    return response.json({
      message: 'Validation failed.',
      errors: error.errors,
    }, 422)
  }

  if (duplicateMessage && isUniqueViolation(error))
    return response.json({ message: duplicateMessage }, 422)

  return dashboardOperationalError(error, message, action, 500)
}
