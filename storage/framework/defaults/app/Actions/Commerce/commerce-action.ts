import type { RequestInstance } from '@stacksjs/types'
import { response } from '@stacksjs/router'

export type CommerceIdentifierResult =
  | { id: number, error?: never }
  | { id?: never, error: Response }

export function commerceIdentifier(
  request: RequestInstance,
  resource: string,
): CommerceIdentifierResult {
  const id = Number(request.getParam('id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    return {
      error: response.json({ message: `${resource} id must be a positive integer.` }, 422),
    }
  }
  return { id }
}

export function commerceNotFound(resource: string, id: number): Response {
  return response.json({ message: `${resource} ${id} was not found.` }, 404)
}

export interface CommerceMinorAmountOptions {
  /** Whether a missing value is an error (create) or leaves the column alone (update). */
  required?: boolean
  /** Smallest accepted amount in minor units. Defaults to 0. */
  min?: number
}

/**
 * A 422 when `request.<field>` is not an integer number of minor units.
 *
 * Money columns hold integer minor units (`1999` is $19.99), and model
 * validation only says "a number", so `19.99` used to be stored as nineteen
 * cents and 99 hundredths and then totalled as such (stacksjs/stacks#2851).
 * The dashboard converts what people type before sending it; this stops any
 * other caller writing a decimal.
 */
export function commerceMinorAmountError(
  request: RequestInstance,
  field: string,
  label: string,
  options: CommerceMinorAmountOptions = {},
): Response | undefined {
  const raw = request.get(field) as unknown
  if (raw === undefined || raw === null || raw === '') {
    if (!options.required)
      return undefined
    return minorAmountResponse(field, `${label} is required.`)
  }

  const amount = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : raw
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount))
    return minorAmountResponse(field, `${label} must be a whole number of minor units, for example 1999 for 19.99.`)

  const min = options.min ?? 0
  if (amount < min)
    return minorAmountResponse(field, `${label} must be at least ${min}.`)

  return undefined
}

function minorAmountResponse(field: string, message: string): Response {
  return response.json({ message, errors: { [field]: [message] } }, 422)
}
